// Mock of the club-server meetings module (MeetingHandlers, MeetingTypeHandlers, MeetingType).
import { generatedKey } from '../../lib/mock/keys';
import { directory, MockDirectory } from '../../lib/mock/core';
import { MockServer, mockServer, type MockRequest } from '../../lib/mock/MockServer';
import { MockTable } from '../../lib/mock/MockTable';
import { resolveRef } from '../../lib/mock/recordRefs';
import { files } from '../files/mock';
import { defaultTemplate, fill, protocolTemplate, TEMPLATE_NAME } from './invitationDocument';
import type { RefKind } from '../../lib/records/refs';
import { ADMIN_BOARD, type Member } from '../../lib/types';
import type { OfficeKind } from '../members/MembersApi';
import { officeUses } from '../members/mock';
import { tasks } from '../tasks/mock';
import {
  ALL_MAJORITIES,
  defaultSteps,
  seedMeetings,
  seedResolutions,
  SEEDED_TYPES,
  type StoredMeeting,
  type StoredResolution,
  type StoredType,
} from './mockSeeds';
import {
  isAssembly,
  quorumReached,
  SEEDED_CIRCULAR,
  type AgendaItem,
  type CircularRules,
  type ResolutionSummary,
  type ResolutionRules,
  isDayOfYear,
  isQuorate,
  latestInvite,
  majorities,
  mayConvene,
  type Choice,
  type Majority,
  type Meeting,
  type MeetingKind,
  type MeetingSummary,
  type MeetingType,
  type MeetingStep,
  type Quorum,
  type Resolution,
  type VoteMode,
  type StepAnchor,
  type StepAudience,
} from './model';

const fail = MockServer.fail;
const DAY = 86_400_000;

const ANCHORS: readonly StepAnchor[] = ['BEFORE_INVITE', 'BEFORE_START', 'AFTER_END'];
const AUDIENCES: readonly StepAudience[] = ['ELECTORATE', 'BOARD', 'CONVENERS', 'SECRETARY'];

/** server: MeetingStep record and MeetingTypeHandlers.steps. */
function checkedSteps(value: unknown): MeetingStep[] {
  if (value == null) return defaultSteps(false);
  if (!Array.isArray(value) || value.length > 30) return fail(400, 'meeting-step.too-many');
  const systems = new Set<string>();
  return value.map((s: Record<string, any>) => {
    if (!ANCHORS.includes(s.anchor) || !AUDIENCES.includes(s.audience) || (s.action !== 'NOTIFICATION' && s.action !== 'TASK'))
      fail(400, 'meeting-step.invalid');
    if (!Number.isInteger(s.offsetHours) || s.offsetHours < 0 || s.offsetHours > 8760) fail(400, 'meeting-step.offset-invalid');
    if (s.system) {
      if (systems.has(s.system)) fail(400, 'meeting-step.invalid');
      systems.add(s.system);
      const own = s.system === 'INVITE_REMINDER' ? 'BEFORE_INVITE' : 'BEFORE_START';
      if (s.anchor !== own || s.action !== 'NOTIFICATION') fail(400, 'meeting-step.system-fixed');
      return {
        id: s.id ?? crypto.randomUUID(),
        anchor: s.anchor,
        offsetHours: s.offsetHours,
        action: s.action,
        audience: s.audience,
        title: null,
        body: null,
        system: s.system,
      };
    }
    const title = text(s.title, 150, 'meeting-step.title-invalid') ?? fail(400, 'meeting-step.title-invalid');
    return {
      id: s.id ?? crypto.randomUUID(),
      anchor: s.anchor,
      offsetHours: s.offsetHours,
      action: s.action,
      audience: s.audience,
      title,
      body: text(s.body, 1000, 'meeting-step.title-invalid'),
      system: null,
    };
  });
}

const QUORUMS: readonly Quorum[] = ['AT_LEAST_HALF', 'MORE_THAN_HALF', 'AT_LEAST_THREE_QUARTERS'];
const text = (value: unknown, max: number, code: string): string | null => {
  if (value == null) return null;
  const t = String(value).trim();
  if (t.length > max) fail(400, code);
  return t || null;
};

export class MockMeetings {
  /** server: meetings_setting */
  readonly circular = new MockTable<CircularRules>('circular-rules', () => ({ ...SEEDED_CIRCULAR }));
  readonly types = new MockTable<StoredType[]>('meeting-types', () => structuredClone([...SEEDED_TYPES]));
  readonly meetings = new MockTable<StoredMeeting[]>('meetings', () => seedMeetings());
  readonly resolutions = new MockTable<StoredResolution[]>('resolutions', () => seedResolutions());
  /** meetingId → its folder and generated invitation (server: meetings_document). */
  readonly documents = new MockTable<Record<string, { folderId: string; fileId: string }>>('meeting-documents', () => ({}));

  constructor(private readonly people: MockDirectory) {
    this.addMissingSeeds();
    // server: the hourly reminder run gives every draft and open circular vote its deadline task
    for (const m of this.meetings.data.filter((x) => x.status === 'DRAFT')) this.inviteTask(m);
    for (const r of this.resolutions.data.filter((x) => !x.meetingId && x.status === 'OPEN')) this.circularTask(r, 'vorstand');
    mockServer.events.subscribe((event) => {
      const data = event.data as Record<string, any>;
      if (event.type === 'members.member-erased') {
        // server: MeetingRepository.renameMemberLinks
        for (const record of [...this.meetings.data, ...this.resolutions.data]) {
          for (const link of record.links ?? []) if (link.kind === 'MEMBER' && link.id === data.memberId) link.title = MockDirectory.ERASED_NAME;
        }
        this.meetings.save();
        this.resolutions.save();
      }
    });
  }

  // --- resolution rules (server: MeetingTypeHandlers.saveRules) ---

  /** Circular votes run 1 hour to 30 days and need a quorum. */
  saveRules(viewer: Member, body: Record<string, any>): ResolutionRules {
    this.people.requirePrivileged(viewer, ADMIN_BOARD);
    const c = body.circular as CircularRules | undefined;
    if (!c || !Number.isInteger(c.minHours) || c.minHours < 1 || c.minHours > 720 || !QUORUMS.includes(c.quorum))
      fail(400, 'resolution-rules.circular-invalid');
    Object.assign(this.circular.data, { minHours: c!.minHours, quorum: c!.quorum });
    this.circular.save();
    mockServer.events.publish({ type: 'meetings.resolution-rules-changed', data: {} });
    return { circular: this.circular.data };
  }

  private name(id: string): string {
    const p = this.people.members.data.find((x) => x.id === id);
    return p ? `${p.firstName} ${p.lastName}` : '–';
  }

  setResolutionLinks(viewer: Member, id: string, refs: unknown): Resolution {
    const r = this.managedResolution(viewer, id);
    if (!Array.isArray(refs) || refs.length > 30) return fail(400, 'resolution.too-many-refs');
    const kept = r.links ?? [];
    r.links = (refs as { kind: RefKind; id: string }[]).map(
      (ref) =>
        kept.find((k) => k.kind === ref.kind && k.id === ref.id) ??
        resolveRef(viewer, ref, 'resolution', (other) => {
          const m = this.meetings.data.find((x) => x.id === other);
          return m && this.maySee(viewer, m) ? m.title : null;
        }),
    );
    this.resolutionChanged(r, 'UPDATED');
    return this.resolutionDto(viewer, r);
  }

  /** server: ResolutionHandlers.setAssignees */
  setResolutionAssignees(viewer: Member, id: string, body: Record<string, any>): Resolution {
    const r = this.managedResolution(viewer, id);
    if (r.status === 'CLOSED') fail(409, 'resolution.closed');
    r.assigneeIds = this.checkedAssignees(body.assigneeIds);
    this.resolutionChanged(r, 'UPDATED');
    return this.resolutionDto(viewer, r);
  }

  /** server: ResolutionTasks.checkedAssignees — any active members, at most 30. */
  private checkedAssignees(value: unknown): string[] {
    const ids = Array.isArray(value) ? [...new Set(value.map(String))] : [];
    if (ids.length > 30) fail(400, 'meeting.too-many-assignees');
    if (ids.some((id) => !this.people.members.data.some((m) => m.id === id && m.active))) fail(400, 'meeting.assignee-unknown');
    return ids;
  }

  /** server: Resolution.majorityFor — the requested one if the type allows it, else the simple one where allowed, else the lowest. */
  private majorityFor(type: MeetingType | null, requested: unknown): Majority {
    const allowed = majorities(type);
    if (requested == null) return allowed.includes('SIMPLE') ? 'SIMPLE' : allowed[0];
    return allowed.includes(requested as Majority) ? (requested as Majority) : fail(400, 'resolution.majority-invalid');
  }

  private static date(value: unknown): string | null {
    if (value == null || value === '') return null;
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fail(400, 'request.invalid');
  }

  /** A draft Beschluss of a meeting (server: Resolution.draft). */
  private draft(
    viewer: Member,
    meetingId: string | null,
    title: string,
    body: Record<string, any>,
    majority: Majority,
    deadline: string | null,
  ): StoredResolution {
    return {
      id: crypto.randomUUID(),
      createdBy: viewer.id,
      meetingId,
      title,
      text: text(body.text, 4000, 'resolution.text-too-long'),
      majority,
      status: 'DRAFT',
      deadline,
      voters: null,
      analogYes: null,
      analogNo: null,
      analogAbstain: null,
      result: null,
      openedAt: null,
      closedAt: null,
      yes: 0,
      no: 0,
      abstain: 0,
      ballots: [],
      assigneeIds: this.checkedAssignees(body.assigneeIds),
      implementDue: MockMeetings.date(body.implementDue),
    };
  }

  /** server: MeetingHandlers.checkedItems */
  private static checkedItems(items: unknown): Record<string, any>[] {
    const given = Array.isArray(items) ? (items as Record<string, any>[]) : [];
    if (
      given.length > 50 ||
      given.some((i) => !String(i?.title ?? '').trim() || String(i.title).trim().length > 200 || (i.note && String(i.note).length > 1000))
    )
      fail(400, 'meeting.agenda-invalid');
    return given;
  }

  /**
   * server: MeetingHandlers.applyItems — items with a motion create or update the meeting's draft resolutions (titled like the item);
   * a resolution that was on the agenda and is left out goes while it is a draft.
   */
  private applyItems(viewer: Member, meeting: StoredMeeting, given: Record<string, any>[]): AgendaItem[] {
    const type = this.type(meeting.kind);
    const own = this.resolutions.data.filter((r) => r.meetingId === meeting.id);
    const listed = (meeting.agendaItems ?? []).map((i) => i.resolutionId).filter((id): id is string => !!id);
    const kept = new Set<string>();
    const out = given.map((i) => {
      const title = String(i.title).trim();
      let resolutionId: string | null = i.resolutionId ?? null;
      if (resolutionId && (!own.some((r) => r.id === resolutionId) || kept.has(resolutionId))) fail(400, 'meeting.agenda-invalid');
      if (resolutionId) kept.add(resolutionId);
      if (i.motion) {
        const existing = resolutionId ? own.find((r) => r.id === resolutionId)! : null;
        if (!existing) {
          const r = this.draft(viewer, meeting.id, title, i.motion, this.majorityFor(type, i.motion.majority), null);
          this.resolutions.data.push(r);
          this.resolutionChanged(r, 'CREATED');
          resolutionId = r.id;
          kept.add(r.id);
        } else if (existing.status === 'DRAFT') {
          Object.assign(existing, {
            title,
            text: text(i.motion.text, 4000, 'resolution.text-too-long'),
            majority: this.majorityFor(type, i.motion.majority),
            assigneeIds: this.checkedAssignees(i.motion.assigneeIds),
            implementDue: MockMeetings.date(i.motion.implementDue),
          });
          this.resolutionChanged(existing, 'UPDATED');
        }
      }
      return { id: i.id ?? crypto.randomUUID(), title, note: String(i.note ?? '').trim() || null, resolutionId };
    });
    for (const id of listed.filter((x) => !kept.has(x))) {
      const left = own.find((r) => r.id === id);
      if (!left) continue;
      if (left.status !== 'DRAFT') fail(409, 'meeting.agenda-motion-voted');
      this.resolutions.data.splice(this.resolutions.data.indexOf(left), 1);
      this.resolutionChanged(left, 'DELETED');
    }
    return out;
  }

  /** server: Agenda.sync — the agenda text follows the items. */
  private setItems(meeting: StoredMeeting, items: AgendaItem[]): void {
    meeting.agendaItems = items;
    meeting.agenda = items.map((i, k) => `${k + 1}. ${i.title}`).join('\n') || null;
  }

  /** Seeded meetings and votes added later reach browsers that already stored mock data. */
  private addMissingSeeds(): void {
    const meetings = seedMeetings().filter((m) => !this.meetings.data.some((x) => x.id === m.id));
    const resolutions = seedResolutions().filter((r) => !this.resolutions.data.some((x) => x.id === r.id));
    if (!meetings.length && !resolutions.length) return;
    this.meetings.data.push(...meetings);
    this.resolutions.data.push(...resolutions);
    this.meetings.save();
    this.resolutions.save();
  }

  list(viewer: Member, from: string | null, to: string | null): { items: MeetingSummary[] } {
    return {
      items: this.meetings.data
        .filter((m) => this.maySee(viewer, m) && (!from || m.startsAt >= from) && (!to || m.startsAt < to))
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
        .map(({ id, kind, title, startsAt, endsAt, location, status }) => ({ id, kind, title, startsAt, endsAt, location, status })),
    };
  }

  get(viewer: Member, id: string): Meeting {
    return this.dto(viewer, this.visible(viewer, id));
  }

  create(viewer: Member, body: Record<string, any>): Meeting {
    this.people.requirePrivileged(viewer, ADMIN_BOARD);
    const type = this.types.data.find((t) => t.key === body.kind) ?? fail(400, 'meeting.kind-unknown');
    if (type.archived) fail(400, 'meeting.kind-archived');
    const kind = type.key;
    if (!this.mayConvene(viewer, kind)) fail(403, 'meeting.may-not-convene');
    const meeting: StoredMeeting = {
      id: crypto.randomUUID(),
      kind,
      title: '',
      agenda: null,
      urgency: null,
      startsAt: '',
      endsAt: '',
      location: null,
      videoUrl: null,
      status: 'DRAFT',
      invitedAt: null,
      openedAt: null,
      closedAt: null,
      protocol: null,
      createdBy: viewer.id,
      presence: {},
      links: [],
    };
    const items = MockMeetings.checkedItems(body.items);
    this.apply(meeting, body);
    this.meetings.data.push(meeting);
    this.setItems(meeting, this.applyItems(viewer, meeting, items));
    this.changed(meeting, 'CREATED');
    return this.dto(viewer, meeting);
  }

  update(viewer: Member, id: string, body: Record<string, any>): Meeting {
    const meeting = this.managed(viewer, id);
    // server: Meeting.withDetails
    if (meeting.status === 'CANCELLED') fail(409, 'meeting.cancelled');
    const details = ['title', 'urgency', 'startsAt', 'endsAt', 'location', 'videoUrl'].some((k) => body[k] != null);
    if (details && meeting.status === 'CLOSED') fail(409, 'meeting.closed');
    const moves = (body.startsAt && body.startsAt !== meeting.startsAt) || (body.endsAt && body.endsAt !== meeting.endsAt);
    if (moves && meeting.status !== 'DRAFT') fail(409, 'meeting.invited-time-fixed');
    if (body.protocol != null) {
      if (meeting.status !== 'OPEN' && meeting.status !== 'CLOSED') fail(409, 'meeting.protocol-not-yet');
      if (this.protocolFinalAt(meeting)) fail(409, 'meeting.protocol-final');
      if (String(body.protocol).length > 20000) fail(400, 'meeting.protocol-too-long');
    }
    if (typeof body.location === 'string' && body.location.length > 200) fail(400, 'meeting.location-too-long');
    const before = { Titel: meeting.title, Tagesordnung: meeting.agenda, Ort: meeting.location, Videolink: meeting.videoUrl };
    this.apply(meeting, body);
    const after = { Titel: meeting.title, Tagesordnung: meeting.agenda, Ort: meeting.location, Videolink: meeting.videoUrl };
    const changedFields = (Object.keys(before) as (keyof typeof before)[]).filter((k) => before[k] !== after[k]);
    if (changedFields.length) this.noticeChange(meeting, changedFields);
    this.changed(meeting, 'UPDATED');
    return this.dto(viewer, meeting);
  }

  delete(viewer: Member, id: string): void {
    const meeting = this.managed(viewer, id);
    if (meeting.status !== 'DRAFT') fail(409, 'meeting.not-draft');
    this.meetings.data.splice(this.meetings.data.indexOf(meeting), 1);
    this.changed(meeting, 'DELETED');
  }

  invite(viewer: Member, id: string): Meeting {
    const meeting = this.managed(viewer, id);
    if (meeting.status !== 'DRAFT') fail(409, 'meeting.already-invited');
    if (new Date().toISOString() > latestInvite(this.type(meeting.kind), meeting.startsAt)) fail(409, 'meeting.notice-too-short');
    meeting.status = 'INVITED';
    meeting.invitedAt = new Date().toISOString();
    this.changed(meeting, 'INVITED');
    mockServer.events.publish({
      type: 'meetings.meeting-invited',
      data: {
        meetingId: meeting.id,
        recipients: this.electorate(meeting.kind),
        kind: meeting.kind,
        title: meeting.title,
        // server: MeetingHandlers.invitedItems — every item, Beschlüsse with their text
        items: (meeting.agendaItems ?? []).map((i) => {
          const r = i.resolutionId ? this.resolutions.data.find((x) => x.id === i.resolutionId) : undefined;
          return { title: i.title, resolution: !!r, motion: r?.text ?? null };
        }),
        startsAt: meeting.startsAt,
        location: meeting.location,
        videoUrl: meeting.videoUrl,
      },
    });
    return this.dto(viewer, meeting);
  }

  open(viewer: Member, id: string): Meeting {
    const meeting = this.managed(viewer, id);
    if (meeting.status !== 'INVITED') fail(409, 'meeting.not-invited');
    Object.assign(meeting, { status: 'OPEN', openedAt: new Date().toISOString(), frozenElectorate: this.electorate(meeting.kind) });
    this.changed(meeting, 'OPENED');
    const video = this.type(meeting.kind).online ? (meeting.videoUrl ?? this.type(meeting.kind).videoUrl ?? null) : null;
    this.notice(
      this.meetingVoters(meeting),
      `Sitzung eröffnet: ${meeting.title}`,
      video ? `Online dabei: ${video}` : 'Die Sitzung hat begonnen.',
      `/meetings/${id}`,
    );
    return this.dto(viewer, meeting);
  }

  close(viewer: Member, id: string, protocol: unknown): Meeting {
    const meeting = this.managed(viewer, id);
    if (meeting.status !== 'OPEN') fail(409, 'meeting.not-open');
    if (this.resolutions.data.some((r) => r.meetingId === id && r.status === 'OPEN')) fail(409, 'meeting.votes-open');
    const text = typeof protocol === 'string' ? protocol.trim() || null : null;
    Object.assign(meeting, { status: 'CLOSED', closedAt: new Date().toISOString(), protocol: text ?? meeting.protocol, protocolFinalAt: null });
    this.notice(this.meetingVoters(meeting), `Sitzung beendet: ${meeting.title}`, 'Beschlüsse und Protokoll sind in der App.', `/meetings/${id}`);
    this.changed(meeting, 'CLOSED');
    return this.dto(viewer, meeting);
  }

  /** server: FinalizeProtocol — after the meeting the protocol no longer changes. */
  finalizeProtocol(viewer: Member, id: string): Meeting {
    const meeting = this.managed(viewer, id);
    if (meeting.status !== 'CLOSED') fail(409, 'meeting.not-closed');
    if (this.protocolFinalAt(meeting)) fail(409, 'meeting.protocol-final');
    meeting.protocolFinalAt = new Date().toISOString();
    this.changed(meeting, 'UPDATED');
    return this.dto(viewer, meeting);
  }

  /** server: MeetingHandlers.cancel — an invited meeting is called off, the invitees are told. */
  cancel(viewer: Member, id: string): Meeting {
    const meeting = this.managed(viewer, id);
    if (meeting.status !== 'INVITED') fail(409, 'meeting.not-invited');
    Object.assign(meeting, { status: 'CANCELLED', closedAt: new Date().toISOString() });
    this.changed(meeting, 'CANCELLED');
    mockServer.events.publish({
      type: 'meetings.meeting-cancelled',
      data: { meetingId: meeting.id, recipients: this.meetingVoters(meeting), title: meeting.title, startsAt: meeting.startsAt },
    });
    return this.dto(viewer, meeting);
  }

  /** server: MeetingHandlers.setAgenda — ordered items, Beschlüsse among them; the agenda text follows them. */
  setAgenda(viewer: Member, id: string, items: unknown): Meeting {
    const meeting = this.managed(viewer, id);
    if (meeting.status === 'CLOSED') fail(409, 'meeting.closed');
    if (meeting.status === 'CANCELLED') fail(409, 'meeting.cancelled');
    const given = MockMeetings.checkedItems(items);
    const before = meeting.agenda;
    this.setItems(meeting, this.applyItems(viewer, meeting, given));
    if (before !== meeting.agenda) this.noticeChange(meeting, ['Tagesordnung']);
    this.changed(meeting, 'UPDATED');
    return this.dto(viewer, meeting);
  }

  /** server: MeetingsApi.MEETING_NOTICE */
  private notice(recipients: readonly string[], title: string, body: string, link: string): void {
    mockServer.events.publish({ type: 'meetings.meeting-notice', data: { recipients, title, body, link } });
  }

  /** server: MeetingHandlers.noticeChanges — after the invitation the electorate hears of changes. */
  private noticeChange(meeting: StoredMeeting, what: string[]): void {
    if (meeting.status !== 'INVITED' && meeting.status !== 'OPEN') return;
    this.notice(this.meetingVoters(meeting), `Geändert: ${meeting.title}`, `Geändert: ${what.join(', ')}.`, `/meetings/${meeting.id}`);
  }

  setPresenceMany(viewer: Member, id: string, memberIds: unknown, present: unknown): Meeting {
    const ids = Array.isArray(memberIds) ? (memberIds as string[]) : [];
    let last: Meeting | null = null;
    for (const memberId of ids) last = this.setPresence(viewer, id, memberId, present);
    return last ?? this.dto(viewer, this.managed(viewer, id));
  }

  /** server: MeetingHandlers.checkIn — the voter themselves while the meeting is open. */
  checkIn(viewer: Member, id: string): Meeting {
    const meeting = this.visible(viewer, id);
    if (meeting.status !== 'OPEN') fail(409, 'meeting.not-open');
    if (!this.meetingVoters(meeting).includes(viewer.id)) fail(400, 'meeting.not-voter');
    if (this.type(meeting.kind).selfCheckIn === false) fail(409, 'meeting.check-in-off');
    if (this.resolutions.data.some((r) => r.meetingId === id && r.status === 'OPEN')) fail(409, 'meeting.vote-open');
    meeting.presence[viewer.id] = true;
    this.changed(meeting, 'PRESENCE');
    return this.dto(viewer, meeting);
  }

  /** server: MeetingHandlers.approveProtocol — chair and secretary, once each, after it is final. */
  approveProtocol(viewer: Member, id: string): Meeting {
    const meeting = this.visible(viewer, id);
    if (!this.protocolFinalAt(meeting)) fail(409, 'meeting.protocol-not-final');
    // server: the meeting's Vorsitz and Schriftführer:in; without a pick the office holders
    const offices = this.offices(viewer);
    const office =
      viewer.id === meeting.chairId
        ? 'CHAIR'
        : viewer.id === meeting.secretaryId
          ? 'SECRETARY'
          : !meeting.chairId && offices.includes('CHAIR')
            ? 'CHAIR'
            : !meeting.secretaryId && offices.includes('SECRETARY')
              ? 'SECRETARY'
              : fail(403, 'meeting.approve-not-allowed');
    meeting.approvals ??= [];
    if (meeting.approvals.some((a) => a.memberId === viewer.id)) fail(409, 'meeting.protocol-approved');
    meeting.approvals.push({ memberId: viewer.id, name: this.name(viewer.id), office, at: new Date().toISOString() });
    this.changed(meeting, 'UPDATED');
    return this.dto(viewer, meeting);
  }

  /** server: MeetingHandlers.setRoles — Vorsitz and Schriftführer:in among the voters present, two different people. */
  setRoles(viewer: Member, id: string, body: Record<string, any>): Meeting {
    const meeting = this.managed(viewer, id);
    if (meeting.status === 'DRAFT' || meeting.status === 'CANCELLED' || this.protocolFinalAt(meeting)) fail(409, 'meeting.roles-fixed');
    const chair = (body.chairId as string | null) ?? null;
    const secretary = (body.secretaryId as string | null) ?? null;
    if ((chair && !meeting.presence[chair]) || (secretary && !meeting.presence[secretary])) fail(400, 'meeting.role-not-present');
    if (chair && chair === secretary) fail(400, 'meeting.roles-same');
    Object.assign(meeting, { chairId: chair, secretaryId: secretary });
    this.changed(meeting, 'UPDATED');
    return this.dto(viewer, meeting);
  }

  /** Whoever leaves the presence gives up the role. */
  private dropRolesOfAbsent(meeting: StoredMeeting): void {
    if (meeting.chairId && !meeting.presence[meeting.chairId]) meeting.chairId = null;
    if (meeting.secretaryId && !meeting.presence[meeting.secretaryId]) meeting.secretaryId = null;
  }

  /** server: MeetingHandlers.generateProtocol — the protocol as a document in the meeting's folder, linked first. */
  async generateProtocol(viewer: Member, id: string): Promise<Meeting> {
    const meeting = this.managed(viewer, id);
    if (meeting.status !== 'CLOSED') fail(409, 'meeting.not-closed');
    const { default: JSZip } = await import('jszip');
    const type = this.type(meeting.kind);
    const results = this.resolutions.data
      .filter((r) => r.meetingId === id)
      .map(
        (r) =>
          `${r.title}: ${r.result === 'PASSED' ? 'angenommen' : r.result === 'FAILED' ? 'abgelehnt' : r.result ? 'nicht beschlussfähig' : 'nicht abgestimmt'}`,
      );
    const fmt = (iso: string, options: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat('de-AT', { timeZone: this.people.club.timeZone, ...options }).format(new Date(iso));
    const content = await fill(
      JSZip,
      await protocolTemplate(JSZip),
      {
        Verein: this.people.clubInfo().name,
        Art: type.invitationLabel,
        Titel: meeting.title.toLowerCase() === type.label.toLowerCase() ? null : meeting.title,
        Wann: `${fmt(meeting.startsAt, { dateStyle: 'full', timeStyle: 'short' })} bis ${fmt(meeting.endsAt, { timeStyle: 'short' })} Uhr`,
        Ort: meeting.location,
        Vorsitz: meeting.chairId ? this.name(meeting.chairId) : null,
        Schriftführer: meeting.secretaryId ? this.name(meeting.secretaryId) : null,
        Anwesend:
          Object.keys(meeting.presence)
            .map((m) => this.name(m))
            .join(', ') || null,
        Beschlussfähig: this.quorate(meeting, this.meetingVoters(meeting)) ? 'ja' : 'nein',
        Agenda: meeting.agenda?.replaceAll('\n', '; ') ?? null,
        Beschlüsse: results.join('; ') || null,
      },
      (meeting.protocol ?? 'Kein Protokolltext eingetragen.')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
    );
    const assembly = isAssembly(type);
    const name = assembly ? 'Mitgliederversammlungen' : 'Vorstandssitzungen';
    const scope = assembly ? 'ASSEMBLY' : 'BOARD';
    const parent =
      files.listFolders(viewer).find((f) => !f.parentId && f.name === name && f.scope === scope) ??
      files.createFolder(viewer, { name, kind: 'DOCUMENTS', scope, teamIds: [] });
    const day = meeting.startsAt.slice(0, 10);
    const folderId =
      this.documents.data[id]?.folderId && files.listFolders(viewer).some((f) => f.id === this.documents.data[id].folderId)
        ? this.documents.data[id].folderId
        : files.createFolder(viewer, { parentId: parent.id, name: `${day} ${meeting.title}`.slice(0, 100), kind: 'DOCUMENTS' }).id;
    const form = new FormData();
    form.append('file', new File([content], `Protokoll ${day} ${meeting.title}.docx`));
    const file = await files.upload({ params: { folderId }, query: new URLSearchParams(), body: form, email: viewer.email } as never);
    meeting.links = [{ kind: 'FILE' as const, id: file.id, title: file.name, parentId: folderId }, ...(meeting.links ?? [])].slice(0, 30);
    this.changed(meeting, 'UPDATED');
    return this.dto(viewer, meeting);
  }

  /** Seeded closed meetings count as final (server: V83). */
  private protocolFinalAt(m: StoredMeeting): string | null {
    return m.protocolFinalAt !== undefined ? m.protocolFinalAt : m.status === 'CLOSED' ? m.closedAt : null;
  }

  /** server: MeetingHandlers.setPresence — Anwesend or not; fixed while a vote is open. */
  setPresence(viewer: Member, id: string, memberId: string, present: unknown): Meeting {
    const meeting = this.managed(viewer, id);
    if (meeting.status === 'DRAFT') fail(409, 'meeting.not-invited');
    if (meeting.status === 'CLOSED') fail(409, 'meeting.closed');
    if (meeting.status === 'CANCELLED') fail(409, 'meeting.cancelled');
    if (this.resolutions.data.some((r) => r.meetingId === id && r.status === 'OPEN')) fail(409, 'meeting.vote-open');
    if (!this.meetingVoters(meeting).includes(memberId)) fail(400, 'meeting.not-voter');
    if (present === true) meeting.presence[memberId] = true;
    else delete meeting.presence[memberId];
    this.dropRolesOfAbsent(meeting);
    this.changed(meeting, 'PRESENCE');
    return this.dto(viewer, meeting);
  }

  /** server: MeetingHandlers.setLinks — new links resolved as the viewer sees them, kept ones stay. */
  setLinks(viewer: Member, id: string, refs: unknown): Meeting {
    const meeting = this.managed(viewer, id);
    if (!Array.isArray(refs) || refs.length > 30) return fail(400, 'meeting.too-many-refs');
    const kept = meeting.links ?? [];
    meeting.links = (refs as { kind: RefKind; id: string }[]).map((ref) => {
      if (ref.kind === 'MEETING' && ref.id === id) return fail(400, 'meeting.ref-unknown');
      return (
        kept.find((k) => k.kind === ref.kind && k.id === ref.id) ??
        resolveRef(viewer, ref, 'meeting', (other) => {
          const m = this.meetings.data.find((x) => x.id === other);
          return m && this.maySee(viewer, m) ? m.title : null;
        })
      );
    });
    this.changed(meeting, 'UPDATED');
    return this.dto(viewer, meeting);
  }

  /** server: MeetingHandlers.generateInvitation + InvitationDocuments — the template in "Vorlagen" filled through the files mock. */
  async generateInvitation(viewer: Member, id: string): Promise<Meeting> {
    const meeting = this.managed(viewer, id);
    const { default: JSZip } = await import('jszip');
    const request = (params: Record<string, string>, form: FormData) => ({ params, query: new URLSearchParams(), body: form, email: viewer.email });
    const top = (name: string, scope: 'ASSEMBLY' | 'BOARD') =>
      files.listFolders(viewer).find((f) => !f.parentId && f.name === name && f.scope === scope) ??
      files.createFolder(viewer, { name, kind: 'DOCUMENTS', scope, teamIds: [] });

    const templates = top('Vorlagen', 'BOARD');
    let template = files.listFiles(viewer, templates.id).find((f) => f.name.toLowerCase() === TEMPLATE_NAME.toLowerCase());
    if (!template) {
      const form = new FormData();
      form.append('file', new File([await defaultTemplate(JSZip)], TEMPLATE_NAME));
      template = await files.upload(request({ folderId: templates.id }, form));
    }
    // Mock blobs live only for the session; after a reload the built-in template stands in.
    const templateBytes = files.blob(template.id) ?? (await defaultTemplate(JSZip));
    const type = this.type(meeting.kind);
    const fmt = (iso: string, options: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat('de-AT', { timeZone: this.people.club.timeZone, ...options }).format(new Date(iso));
    const content = await fill(
      JSZip,
      templateBytes,
      {
        Verein: this.people.clubInfo().name,
        Art: type.invitationLabel,
        Titel: meeting.title.toLowerCase() === type.label.toLowerCase() ? null : meeting.title,
        Wann: `${fmt(meeting.startsAt, { dateStyle: 'full', timeStyle: 'short' })} bis ${fmt(meeting.endsAt, { timeStyle: 'short' })} Uhr`,
        Ort: meeting.location,
        Video: meeting.videoUrl,
        Dringlichkeit: meeting.urgency,
        // A placeholder older templates still carry (server: AgendaDocument); empty, so its paragraph is dropped.
        Statuten: null,
        Versandt: fmt(meeting.invitedAt ?? new Date().toISOString(), { dateStyle: 'long' }),
      },
      (meeting.agenda ?? '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .concat(meeting.agenda?.trim() ? [] : ['Keine Tagesordnung eingetragen.']),
    );

    const stored = this.documents.data[id];
    const day = meeting.startsAt.slice(0, 10);
    let fileId: string;
    let folderId: string;
    if (stored && files.files.data.some((f) => f.id === stored.fileId)) {
      const form = new FormData();
      form.append('file', new File([content], 'einladung.docx'));
      form.append('label', new Date().toLocaleString('de-AT').slice(0, 20));
      form.append('date', new Date().toISOString().slice(0, 10));
      await files.uploadVersion(request({ id: stored.fileId }, form));
      ({ fileId, folderId } = stored);
    } else {
      const assembly = isAssembly(type);
      const parent = top(assembly ? 'Mitgliederversammlungen' : 'Vorstandssitzungen', assembly ? 'ASSEMBLY' : 'BOARD');
      folderId =
        stored && files.listFolders(viewer).some((f) => f.id === stored.folderId)
          ? stored.folderId
          : files.createFolder(viewer, { parentId: parent.id, name: `${day} ${meeting.title}`.slice(0, 100), kind: 'DOCUMENTS' }).id;
      const form = new FormData();
      form.append('file', new File([content], `Einladung ${day} ${meeting.title}.docx`));
      fileId = (await files.upload(request({ folderId }, form))).id;
    }
    this.documents.data[id] = { folderId, fileId };
    this.documents.save();
    const name = files.files.data.find((f) => f.id === fileId)!.name;
    meeting.links = [
      { kind: 'FILE' as const, id: fileId, title: name, parentId: folderId },
      ...(meeting.links ?? []).filter((l) => l.id !== fileId),
    ].slice(0, 30);
    this.changed(meeting, 'UPDATED');
    return this.dto(viewer, meeting);
  }

  // --- resolutions (server: ResolutionHandlers) ---

  listResolutions(viewer: Member, meetingId: string | null): { items: Resolution[] } {
    if (meetingId === null) {
      if (!this.people.hasRole(viewer, ADMIN_BOARD)) fail(403, 'access.denied');
      return {
        items: this.resolutions.data
          .filter((r) => r.meetingId === null)
          .reverse()
          .map((r) => this.resolutionDto(viewer, r)),
      };
    }
    this.visible(viewer, meetingId);
    return { items: this.resolutions.data.filter((r) => r.meetingId === meetingId).map((r) => this.resolutionDto(viewer, r)) };
  }

  getResolution(viewer: Member, id: string): Resolution {
    return this.resolutionDto(viewer, this.resolution(viewer, id));
  }

  /** server: ResolutionHandlers.create — with a meeting it is the last agenda item. */
  createResolution(viewer: Member, meetingId: string | null, body: Record<string, any>): Resolution {
    this.people.requirePrivileged(viewer, ADMIN_BOARD);
    const meeting = meetingId ? this.managed(viewer, meetingId) : null;
    if (!meeting && !this.runsCircular(viewer)) fail(403, 'access.denied');
    if (meeting?.status === 'CLOSED' || meeting?.status === 'CANCELLED') fail(409, 'meeting.closed');
    const majority = this.majorityFor(meeting ? this.type(meeting.kind) : null, body.majority ?? null);
    const title = text(body.title, 200, 'resolution.title-invalid') ?? fail(400, 'resolution.title-invalid');
    const deadline = meeting
      ? null
      : typeof body.deadline === 'string'
        ? new Date(body.deadline).toISOString()
        : fail(400, 'resolution.deadline-invalid');
    const r = this.draft(viewer, meetingId, title, body, majority, deadline);
    this.resolutions.data.push(r);
    if (meeting) {
      this.setItems(meeting, [...(meeting.agendaItems ?? []), { id: crypto.randomUUID(), title, note: null, resolutionId: r.id }]);
      this.meetings.save();
    }
    this.resolutionChanged(r, 'CREATED');
    return this.resolutionDto(viewer, r);
  }

  deleteResolution(viewer: Member, id: string): void {
    const r = this.managedResolution(viewer, id);
    if (r.status !== 'DRAFT') fail(409, 'resolution.not-draft');
    this.resolutions.data.splice(this.resolutions.data.indexOf(r), 1);
    const meeting = r.meetingId ? this.meetings.data.find((m) => m.id === r.meetingId) : null;
    if (meeting) {
      this.setItems(
        meeting,
        (meeting.agendaItems ?? []).filter((i) => i.resolutionId !== r.id),
      );
      this.meetings.save();
    }
    this.resolutionChanged(r, 'DELETED');
  }

  /** server: ResolutionHandlers.open — a meeting vote by show of hands or secretly in the app; circular votes in the app. */
  openResolution(viewer: Member, id: string, mode: unknown = null): Resolution {
    const r = this.managedResolution(viewer, id);
    if (r.status !== 'DRAFT') fail(409, 'resolution.not-draft');
    const meeting = r.meetingId ? this.meetings.data.find((m) => m.id === r.meetingId)! : null;
    if (meeting && mode !== 'HAND' && mode !== 'APP') fail(400, 'resolution.vote-mode-missing');
    if (meeting && meeting.status !== 'OPEN') fail(409, 'resolution.meeting-not-open');
    if (meeting && !this.quorate(meeting, this.meetingVoters(meeting))) fail(409, 'resolution.not-quorate');
    if (!meeting && Date.parse(r.deadline!) < Date.now() + this.circular.data.minHours * 3_600_000) fail(400, 'resolution.deadline-too-short');
    const voters = this.voters(r);
    Object.assign(r, {
      status: 'OPEN',
      openedAt: new Date().toISOString(),
      voters: voters.length,
      frozenVoters: meeting ? undefined : voters,
      voteMode: meeting ? (mode as VoteMode) : 'APP',
    });
    this.resolutionChanged(r, 'OPENED');
    if (!meeting) {
      this.circularTask(r, viewer.id);
      mockServer.events.publish({
        type: 'meetings.circular-opened',
        data: { resolutionId: r.id, recipients: voters, title: r.title, text: r.text, deadline: r.deadline },
      });
    }
    return this.resolutionDto(viewer, r);
  }

  /** server: ResolutionHandlers.extend — a circular vote only runs longer; its deadline task follows. */
  extendDeadline(viewer: Member, id: string, deadline: unknown): Resolution {
    const r = this.managedResolution(viewer, id);
    if (r.meetingId) fail(409, 'resolution.not-circular');
    if (r.status !== 'OPEN') fail(409, 'resolution.not-open');
    const next = typeof deadline === 'string' ? deadline : fail(400, 'request.invalid');
    if (next <= r.deadline! || Date.parse(next) <= Date.now() || Date.parse(next) < Date.parse(r.openedAt!) + this.circular.data.minHours * 3_600_000)
      fail(400, 'resolution.deadline-too-short');
    r.deadline = next;
    this.notice(
      this.voters(r).filter((v) => !r.ballots.includes(v)),
      `Länger abstimmen: ${r.title}`,
      'Der Umlaufbeschluss läuft jetzt länger.',
      `/resolutions/${r.id}`,
    );
    tasks.deadline(`deadline-circular-${r.id}`, `Umlaufbeschluss: ${r.title}`, 'Der Umlaufbeschluss schließt dann von selbst.', next, [viewer.id]);
    this.resolutionChanged(r, 'UPDATED');
    return this.resolutionDto(viewer, r);
  }

  closeResolution(viewer: Member, id: string): Resolution {
    const r = this.managedResolution(viewer, id);
    // server: a show of hands needs its counts first
    if (r.voteMode === 'HAND' && r.analogYes === null) fail(409, 'resolution.analog-missing');
    return this.resolutionDto(viewer, this.closeNow(r));
  }

  /** server: ResolutionHandlers.update — a draft motion changes; omitted fields stay. */
  updateResolution(viewer: Member, id: string, body: Record<string, any>): Resolution {
    const r = this.managedResolution(viewer, id);
    if (r.status !== 'DRAFT') fail(409, 'resolution.not-draft');
    const meeting = r.meetingId ? this.meetings.data.find((m) => m.id === r.meetingId)! : null;
    if (body.title != null) r.title = text(body.title, 200, 'resolution.title-invalid') ?? fail(400, 'resolution.title-invalid');
    if (body.text != null) r.text = text(body.text, 4000, 'resolution.text-too-long');
    if (body.majority != null) r.majority = this.majorityFor(meeting ? this.type(meeting.kind) : null, body.majority);
    if (Array.isArray(body.assigneeIds)) r.assigneeIds = this.checkedAssignees(body.assigneeIds);
    if (body.clearDue) r.implementDue = null;
    else if (body.implementDue != null) r.implementDue = MockMeetings.date(body.implementDue);
    // server: renaming renames its agenda item
    if (meeting) {
      this.setItems(
        meeting,
        (meeting.agendaItems ?? []).map((i) => (i.resolutionId === r.id ? { ...i, title: r.title } : i)),
      );
      this.meetings.save();
    }
    this.resolutions.save();
    this.resolutionChanged(r, 'UPDATED' as never);
    return this.resolutionDto(viewer, r);
  }

  /** server: ResolutionHandlers.all — every resolution the viewer sees, newest first. */
  allResolutions(viewer: Member, year: string | null): { items: ResolutionSummary[] } {
    const board = this.people.hasRole(viewer, ADMIN_BOARD);
    const items = this.resolutions.data
      .filter((r) => !year || (r.closedAt && r.closedAt.startsWith(year)))
      .map((r) => {
        const meeting = r.meetingId ? this.meetings.data.find((m) => m.id === r.meetingId) : null;
        const visible = r.meetingId ? !!meeting && this.maySee(viewer, meeting) : board;
        return visible
          ? {
              id: r.id,
              meetingId: r.meetingId,
              meetingTitle: meeting?.title ?? null,
              title: r.title,
              status: r.status,
              result: r.status === 'CLOSED' ? r.result : null,
              openedAt: r.openedAt,
              closedAt: r.closedAt,
            }
          : null;
      })
      .filter((x): x is ResolutionSummary => !!x)
      .sort((a, b) => (b.closedAt ?? b.openedAt ?? '').localeCompare(a.closedAt ?? a.openedAt ?? ''));
    return { items };
  }

  vote(viewer: Member, id: string, choice: Choice): Resolution {
    const r = this.resolution(viewer, id);
    if (!this.voters(r).includes(viewer.id)) fail(403, 'resolution.not-voter');
    if (r.meetingId) {
      if (r.voteMode === 'HAND') fail(409, 'resolution.vote-by-hand');
      if (!this.meetings.data.find((m) => m.id === r.meetingId)!.presence[viewer.id]) fail(409, 'resolution.not-present');
    }
    return this.resolutionDto(viewer, this.cast(r, viewer.id, choice));
  }

  recordVote(viewer: Member, id: string, memberId: string, choice: Choice): Resolution {
    const r = this.managedResolution(viewer, id);
    if (r.meetingId) fail(409, 'resolution.not-circular');
    if (!this.voters(r).includes(memberId)) fail(400, 'resolution.not-voter');
    return this.resolutionDto(viewer, this.cast(r, memberId, choice));
  }

  /** server: ResolutionHandlers.analog — show of hands, at most the voters present; `close` ends the vote with them. */
  analogVotes(viewer: Member, id: string, body: Record<string, any>, close = false): Resolution {
    const r = this.managedResolution(viewer, id);
    if (!r.meetingId) fail(409, 'resolution.circular');
    if (r.status !== 'OPEN') fail(409, 'resolution.not-open');
    if (r.voteMode !== 'HAND') fail(409, 'resolution.vote-in-app');
    // server: corrected while the vote is open
    const [yes, no, abstain] = [body.yes, body.no, body.abstain].map((v) =>
      Number.isInteger(v) && v >= 0 ? (v as number) : fail(400, 'resolution.analog-invalid'),
    );
    if (yes + no + abstain > this.presentVoters(r)) fail(409, 'resolution.analog-exceeds-present');
    Object.assign(r, { analogYes: yes, analogNo: no, analogAbstain: abstain });
    this.resolutionChanged(r, 'VOTED');
    return this.resolutionDto(viewer, close ? this.closeNow(r) : r);
  }

  private cast(r: StoredResolution, voter: string, choice: Choice): StoredResolution {
    if (!['YES', 'NO', 'ABSTAIN'].includes(choice)) fail(400, 'resolution.choice-missing');
    if (r.status !== 'OPEN') fail(409, 'resolution.not-open');
    if (r.ballots.includes(voter)) fail(409, 'resolution.already-voted');
    r.ballots.push(voter);
    r[choice === 'YES' ? 'yes' : choice === 'NO' ? 'no' : 'abstain'] += 1;
    this.resolutionChanged(r, 'VOTED');
    return !r.meetingId && r.ballots.length >= (r.voters ?? 0) ? this.closeNow(r) : r;
  }

  /** server: Resolution.closed */
  private closeNow(r: StoredResolution): StoredResolution {
    if (r.status !== 'OPEN') fail(409, 'resolution.not-open');
    const yes = r.yes + (r.analogYes ?? 0);
    const valid = yes + r.no + (r.analogNo ?? 0);
    const passes =
      valid > 0 && (r.majority === 'SIMPLE' ? yes * 2 > valid : r.majority === 'TWO_THIRDS' ? yes * 3 >= valid * 2 : yes * 4 >= valid * 3);
    const result =
      !r.meetingId && !quorumReached(this.circular.data.quorum, r.ballots.length, r.voters ?? 0) ? 'NOT_QUORATE' : passes ? 'PASSED' : 'FAILED';
    Object.assign(r, { status: 'CLOSED', closedAt: new Date().toISOString(), result });
    const meeting = r.meetingId ? this.meetings.data.find((m) => m.id === r.meetingId)! : null;
    if (result === 'PASSED') this.passed(r, meeting);
    if (!meeting) {
      tasks.deadlineDone(`deadline-circular-${r.id}`);
      const word = result === 'PASSED' ? 'angenommen' : result === 'FAILED' ? 'abgelehnt' : 'ohne ausreichende Beteiligung';
      this.notice(
        this.voters(r),
        `Umlaufbeschluss ${word}: ${r.title}`,
        `Ja ${r.yes}, Nein ${r.no}, Enthaltung ${r.abstain}.`,
        `/resolutions/${r.id}`,
      );
    }
    this.resolutionChanged(r, 'CLOSED');
    return r;
  }

  /** server: ResolutionTasks.passed — the task "<Titel> umsetzen" for the named active members, else the board. */
  private passed(r: StoredResolution, meeting: StoredMeeting | null): void {
    const named = (r.assigneeIds ?? []).filter((id) => this.people.members.data.some((m) => m.id === id && m.active));
    const assignees = named.length ? named : this.people.electorate('BOARD').slice(0, 30);
    const context = `Beschlossen ${meeting ? `in „${meeting.title}“` : 'im Umlaufverfahren'}.`;
    mockServer.events.publish({
      type: 'meetings.resolution-passed',
      data: {
        resolutionId: r.id,
        title: `${r.title} umsetzen`,
        description: r.text ? `${r.text}\n\n${context}` : context,
        dueAt: r.implementDue ? new Date(`${r.implementDue}T23:59:00`).toISOString() : null,
        assignees,
        createdBy: r.createdBy ?? null,
      },
    });
  }

  private voters(r: StoredResolution): string[] {
    if (r.meetingId) return this.meetingVoters(this.meetings.data.find((m) => m.id === r.meetingId)!);
    return r.status !== 'DRAFT' && r.frozenVoters?.length ? r.frozenVoters : this.people.electorate('BOARD');
  }

  /** Voters present now: the most a show of hands may count. */
  private presentVoters(r: StoredResolution): number {
    const meeting = r.meetingId ? this.meetings.data.find((m) => m.id === r.meetingId) : null;
    if (!meeting) return 0;
    const voters = this.meetingVoters(meeting);
    return Object.keys(meeting.presence).filter((id) => voters.includes(id)).length;
  }

  private runsCircular(viewer: Member): boolean {
    // server: Resolution.runsCircular
    return viewer.roles.includes('ADMIN') || this.offices(viewer).some((o) => o !== 'AUDITOR');
  }

  private resolution(viewer: Member, id: string): StoredResolution {
    const r = this.resolutions.data.find((x) => x.id === id) ?? fail(404, 'resolution.not-found');
    if (r.meetingId) {
      const meeting = this.meetings.data.find((m) => m.id === r.meetingId);
      if (!meeting || !this.maySee(viewer, meeting)) fail(404, 'resolution.not-found');
    } else if (!this.people.hasRole(viewer, ADMIN_BOARD)) fail(404, 'resolution.not-found');
    return r;
  }

  private managesResolution(viewer: Member, r: StoredResolution): boolean {
    if (!r.meetingId) return this.runsCircular(viewer);
    const kind = this.meetings.data.find((m) => m.id === r.meetingId)!.kind;
    return this.mayConvene(viewer, kind) || this.offices(viewer).includes('SECRETARY');
  }

  private managedResolution(viewer: Member, id: string): StoredResolution {
    this.people.requirePrivileged(viewer, ADMIN_BOARD);
    const r = this.resolution(viewer, id);
    if (!this.managesResolution(viewer, r)) fail(403, 'access.denied');
    return r;
  }

  private resolutionDto(viewer: Member, r: StoredResolution): Resolution {
    const { yes, no, abstain, ballots, assigneeIds: _as, implementDue, frozenVoters: _f, links: _l, createdBy: _c, ...rest } = r;
    const closed = r.status === 'CLOSED';
    const voters = this.voters(r);
    const manages = this.managesResolution(viewer, r);
    const task = r.result === 'PASSED' ? tasks.sourced('RESOLUTION', [r.id])[r.id] : undefined;
    const present = r.meetingId ? !!this.meetings.data.find((m) => m.id === r.meetingId)!.presence[viewer.id] : true;
    const name = (id: string) => {
      const p = this.people.members.data.find((x) => x.id === id);
      return p ? `${p.firstName} ${p.lastName}` : '–';
    };
    return {
      ...rest,
      yes: closed ? yes : null,
      no: closed ? no : null,
      abstain: closed ? abstain : null,
      analogYes: closed ? r.analogYes : null,
      analogNo: closed ? r.analogNo : null,
      analogAbstain: closed ? r.analogAbstain : null,
      analogEntered: r.analogYes !== null,
      voteMode: r.voteMode ?? null,
      presentVoters: this.presentVoters(r),
      ballots: ballots.length,
      voted: ballots.includes(viewer.id),
      canVote:
        r.status === 'OPEN' && !ballots.includes(viewer.id) && voters.includes(viewer.id) && (!r.meetingId || (r.voteMode === 'APP' && present)),
      canManage: manages,
      pending:
        !r.meetingId && r.status === 'OPEN' && manages
          ? voters.filter((id) => !ballots.includes(id)).map((id) => ({ memberId: id, name: name(id) }))
          : [],
      assignees: (r.assigneeIds ?? []).map((id) => ({ memberId: id, name: name(id) })),
      implementDue: implementDue ?? null,
      taskId: task?.taskId ?? null,
      taskStatus: task?.status ?? null,
      links: r.links ?? [],
    };
  }

  private resolutionChanged(r: StoredResolution, change: string): void {
    this.resolutions.save();
    const meeting = r.meetingId ? this.meetings.data.find((m) => m.id === r.meetingId) : null;
    mockServer.events.publish({
      type: 'meetings.resolution-changed',
      data: { resolutionId: r.id, meetingId: r.meetingId, change },
      audience: meeting && isAssembly(this.type(meeting.kind)) ? { everyone: true } : { roles: ADMIN_BOARD },
    });
  }

  /** server: Meeting record validation */
  private apply(m: StoredMeeting, body: Record<string, any>): void {
    if (body.title !== undefined) m.title = text(body.title, 120, 'meeting.title-invalid') ?? fail(400, 'meeting.title-invalid');
    if (body.urgency !== undefined) m.urgency = text(body.urgency, 1000, 'meeting.urgency-invalid');
    if (body.location !== undefined) m.location = text(body.location, 200, 'meeting.location-too-long');
    if (body.videoUrl !== undefined) m.videoUrl = text(body.videoUrl, 500, 'meeting.video-url-invalid');
    if (body.protocol !== undefined) m.protocol = text(body.protocol, 20000, 'meeting.protocol-too-long');
    if (body.startsAt) m.startsAt = new Date(body.startsAt).toISOString();
    if (body.endsAt) m.endsAt = new Date(body.endsAt).toISOString();
    if (!m.startsAt || !m.endsAt || m.endsAt <= m.startsAt) fail(400, 'meeting.times-invalid');
    if (Date.parse(m.endsAt) - Date.parse(m.startsAt) > DAY) fail(400, 'meeting.too-long');
    if (m.videoUrl && !m.videoUrl.startsWith('https://')) fail(400, 'meeting.video-url-invalid');
    // server: MeetingType.videoFor — a meeting of an online kind needs its own link or the kind's standing one
    const type = this.type(m.kind);
    if (type.online && !m.videoUrl && !type.videoUrl) fail(400, 'meeting.video-missing');
    if (this.type(m.kind).needsReason !== !!m.urgency) fail(400, 'meeting.urgency-invalid');
    this.meetings.save();
  }

  private electorate(kind: MeetingKind): string[] {
    return this.people.electorate(this.type(kind).electorate);
  }

  private type(kind: MeetingKind): StoredType {
    return this.types.data.find((t) => t.key === kind) ?? fail(400, 'meeting.kind-unknown');
  }

  // --- meeting types (server: MeetingTypeHandlers) ---

  listTypes(): { items: MeetingType[] } {
    const items = [...this.types.data].sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label));
    return { items: items.map((t) => ({ ...t, inUse: this.meetings.data.some((m) => m.kind === t.key) })) };
  }

  /** server: MeetingType record validation. */
  saveType(viewer: Member, key: string | null, body: Record<string, any>): MeetingType {
    this.people.requirePrivileged(viewer, ADMIN_BOARD);
    if (key && !this.types.data.some((t) => t.key === key)) fail(404, 'meeting-type.not-found');
    const label = text(body.label, 80, 'meeting-type.label-invalid') ?? fail(400, 'meeting-type.label-invalid');
    const invitationLabel =
      text(body.invitationLabel, 120, 'meeting-type.invitation-label-invalid') ?? fail(400, 'meeting-type.invitation-label-invalid');
    const subset = <T>(value: unknown, all: readonly T[]): T[] =>
      Array.isArray(value) && value.every((v) => all.includes(v)) ? [...new Set(value as T[])] : fail(400, 'request.invalid');
    const majorities = subset(body.majorities, ALL_MAJORITIES);
    // server: conveners are offices the club has
    const conveners = subset(
      body.conveners,
      directory.boardSettings.data.offices.map((o) => o.office),
    );
    if (body.electorate !== 'BOARD' && body.electorate !== 'ASSEMBLY') fail(400, 'meeting-type.electorate-invalid');
    if (!Number.isInteger(body.noticeHours) || body.noticeHours < 0 || body.noticeHours > 8760) fail(400, 'meeting-type.notice-invalid');
    if (!QUORUMS.includes(body.quorum)) fail(400, 'meeting-type.quorum-invalid');
    if (body.graceMinutes != null && (!Number.isInteger(body.graceMinutes) || body.graceMinutes < 1 || body.graceMinutes > 1440))
      fail(400, 'meeting-type.grace-invalid');
    if (!majorities.length) fail(400, 'meeting-type.majorities-missing');
    if (!conveners.length || conveners.includes('AUDITOR')) fail(400, 'meeting-type.conveners-invalid');
    const dueBy = body.dueBy || null;
    if (dueBy && (!/^\d{2}-\d{2}$/.test(dueBy) || !isDayOfYear(Number(dueBy.slice(0, 2)), Number(dueBy.slice(3)))))
      fail(400, 'meeting-type.due-by-invalid');
    if (body.online && typeof body.videoUrl === 'string' && body.videoUrl.trim() && !body.videoUrl.trim().startsWith('https://'))
      fail(400, 'meeting.video-url-invalid');
    const type: StoredType = {
      key: key ?? generatedKey('TYPE'),
      label,
      invitationLabel,
      electorate: body.electorate,
      noticeHours: body.noticeHours,
      quorum: body.quorum,
      graceMinutes: body.graceMinutes ?? null,
      majorities,
      conveners,
      needsReason: !!body.needsReason,
      dueBy,
      sort: Number.isInteger(body.sort) ? body.sort : 0,
      archived: !!body.archived,
      online: !!body.online,
      videoUrl: body.online && typeof body.videoUrl === 'string' && body.videoUrl.trim() ? body.videoUrl.trim() : null,
      selfCheckIn: body.selfCheckIn !== false,
      inUse: false,
      steps: checkedSteps(body.steps),
    };
    const index = this.types.data.findIndex((t) => t.key === type.key);
    if (index >= 0) this.types.data[index] = type;
    else this.types.data.push(type);
    this.typesChanged();
    return { ...type, inUse: this.meetings.data.some((m) => m.kind === type.key) };
  }

  deleteType(viewer: Member, key: string): void {
    this.people.requirePrivileged(viewer, ADMIN_BOARD);
    const index = this.types.data.findIndex((t) => t.key === key);
    if (index < 0) fail(404, 'meeting-type.not-found');
    if (this.meetings.data.some((m) => m.kind === key)) fail(409, 'meeting-type.in-use');
    this.types.data.splice(index, 1);
    this.typesChanged();
  }

  private typesChanged(): void {
    this.types.save();
    mockServer.events.publish({ type: 'meetings.meeting-types-changed', data: {} });
  }

  /** server: MeetingAccess.electorate — fixed when the meeting opened. */
  private meetingVoters(m: StoredMeeting): string[] {
    return (m.status === 'OPEN' || m.status === 'CLOSED') && m.frozenElectorate?.length ? m.frozenElectorate : this.electorate(m.kind);
  }

  private offices(viewer: Member): OfficeKind[] {
    // server: MeetingAccess.viewer — a club office with the chair's or secretary's duty acts as CHAIR or SECRETARY
    const held = this.people.officesOf(viewer.id);
    const duties = held.flatMap((o) => {
      const duty = this.people.boardSettings.data.offices.find((s) => s.office === o)?.duty;
      return duty === 'CHAIR' || duty === 'SECRETARY' ? [duty] : [];
    });
    return [...new Set([...held, ...duties])];
  }

  /** server: MeetingType.mayConvene */
  private mayConvene(viewer: Member, kind: MeetingKind): boolean {
    return mayConvene(this.type(kind), viewer.roles.includes('ADMIN'), this.offices(viewer));
  }

  private maySee(viewer: Member, m: StoredMeeting): boolean {
    if (this.people.hasRole(viewer, ADMIN_BOARD)) return true;
    // server: MeetingAccess.maySee — voters see a general meeting from its invitation on
    return isAssembly(this.type(m.kind)) && viewer.voter && m.status !== 'DRAFT';
  }

  private visible(viewer: Member, id: string): StoredMeeting {
    const meeting = this.meetings.data.find((m) => m.id === id);
    return meeting && this.maySee(viewer, meeting) ? meeting : fail(404, 'meeting.not-found');
  }

  private managed(viewer: Member, id: string): StoredMeeting {
    this.people.requirePrivileged(viewer, ADMIN_BOARD);
    const meeting = this.visible(viewer, id);
    if (!this.mayConvene(viewer, meeting.kind) && !this.offices(viewer).includes('SECRETARY')) fail(403, 'access.denied');
    return meeting;
  }

  /** server: MeetingAccess.isQuorate */
  private quorate(m: StoredMeeting, voters: string[]): boolean {
    if (m.status !== 'INVITED' && m.status !== 'OPEN') return false;
    return isQuorate(this.type(m.kind), voters.filter((id) => m.presence[id]).length, voters.length, m.startsAt, Date.now());
  }

  private dto(viewer: Member, m: StoredMeeting): Meeting {
    const { presence, frozenElectorate: _frozen, protocolFinalAt: _final, createdBy: _by, agendaItems, approvals, chairId, secretaryId, ...rest } = m;
    const voters = this.meetingVoters(m);
    const name = (id: string) => {
      const p = this.people.members.data.find((x) => x.id === id);
      return p ? `${p.firstName} ${p.lastName}` : '–';
    };
    const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
    const type = this.type(m.kind);
    return {
      ...rest,
      // server: MeetingType.shownVideo
      online: !!type.online,
      videoUrl: type.online ? (m.videoUrl ?? type.videoUrl ?? null) : null,
      links: m.links ?? [], // mock data stored before links existed
      protocolFinalAt: this.protocolFinalAt(m),
      agendaItems: agendaItems ?? [],
      approvals: approvals ?? [],
      latestInvite: latestInvite(this.type(m.kind), m.startsAt),
      electorate: voters.map((id) => ({ memberId: id, name: name(id) })).sort(byName),
      present: Object.keys(presence)
        .map((id) => ({ memberId: id, name: name(id) }))
        .sort(byName),
      quorate: this.quorate(m, voters),
      chair: chairId ? { memberId: chairId, name: name(chairId) } : null,
      secretary: secretaryId ? { memberId: secretaryId, name: name(secretaryId) } : null,
      canManage: this.mayConvene(viewer, m.kind) || this.offices(viewer).includes('SECRETARY'),
    };
  }

  /** server: MeetingReminders.inviteTask — a draft's invitation deadline as a task for the board, moved with the draft. */
  private inviteTask(m: StoredMeeting): void {
    tasks.deadline(
      `deadline-invite-${m.id}`,
      `Einladen: ${m.title}`,
      'Rechtzeitig einladen, sonst ist die Einladungsfrist nicht mehr einzuhalten.',
      latestInvite(this.type(m.kind), m.startsAt),
      this.people.audienceIds({ roles: ['BOARD'] }),
    );
  }

  /** server: MeetingReminders.circularTask — the vote's deadline as a task for whoever started it. */
  private circularTask(r: StoredResolution, startedBy: string): void {
    tasks.deadline(`deadline-circular-${r.id}`, `Umlaufbeschluss: ${r.title}`, 'Der Umlaufbeschluss schließt dann von selbst.', r.deadline!, [
      startedBy,
    ]);
  }

  private changed(m: StoredMeeting, change: string): void {
    this.meetings.save();
    if (change === 'DELETED') tasks.deadlineDrop(`deadline-invite-${m.id}`);
    else if (m.status === 'DRAFT') this.inviteTask(m);
    else tasks.deadlineDone(`deadline-invite-${m.id}`);
    mockServer.events.publish({
      type: 'meetings.meeting-changed',
      data: { meetingId: m.id, change },
      audience: isAssembly(this.type(m.kind)) ? { everyone: true } : { roles: ADMIN_BOARD },
    });
  }
}

export const meetings = new MockMeetings(directory);

// server: MeetingsApi.OFFICE_IN_USE — a convener of a type
officeUses.push((office) => meetings.types.data.some((t) => t.conveners.includes(office)));
const actor = (req: MockRequest) => directory.actor(req);

mockServer
  .on('GET', '/api/v1/meetings', (req) => meetings.list(actor(req), req.query.get('from'), req.query.get('to')))
  .on('GET', '/api/v1/meetings/resolution-rules', (req) => (actor(req), { circular: meetings.circular.data }))
  .on('PUT', '/api/v1/meetings/resolution-rules', (req) => meetings.saveRules(actor(req), req.body ?? {}))
  .on('GET', '/api/v1/meetings/types', (req) => (actor(req), meetings.listTypes()))
  .on('POST', '/api/v1/meetings/types', (req) => meetings.saveType(actor(req), null, req.body ?? {}))
  .on('PUT', '/api/v1/meetings/types/:key', (req) => meetings.saveType(actor(req), req.params.key, req.body ?? {}))
  .on('DELETE', '/api/v1/meetings/types/:key', (req) => meetings.deleteType(actor(req), req.params.key))
  .on('POST', '/api/v1/meetings', (req) => meetings.create(actor(req), req.body ?? {}))
  .on('GET', '/api/v1/meetings/:id', (req) => meetings.get(actor(req), req.params.id))
  .on('PATCH', '/api/v1/meetings/:id', (req) => meetings.update(actor(req), req.params.id, req.body ?? {}))
  .on('DELETE', '/api/v1/meetings/:id', (req) => meetings.delete(actor(req), req.params.id))
  .on('POST', '/api/v1/meetings/:id/invite', (req) => meetings.invite(actor(req), req.params.id))
  .on('POST', '/api/v1/meetings/:id/open', (req) => meetings.open(actor(req), req.params.id))
  .on('POST', '/api/v1/meetings/:id/close', (req) => meetings.close(actor(req), req.params.id, req.body?.protocol))
  .on('POST', '/api/v1/meetings/:id/protocol/final', (req) => meetings.finalizeProtocol(actor(req), req.params.id))
  .on('POST', '/api/v1/meetings/:id/cancel', (req) => meetings.cancel(actor(req), req.params.id))
  .on('PUT', '/api/v1/meetings/:id/agenda', (req) => meetings.setAgenda(actor(req), req.params.id, req.body?.items))
  .on('PUT', '/api/v1/meetings/:id/presence/me', (req) => meetings.checkIn(actor(req), req.params.id))
  .on('PUT', '/api/v1/meetings/:id/presence', (req) => meetings.setPresenceMany(actor(req), req.params.id, req.body?.memberIds, req.body?.present))
  .on('PUT', '/api/v1/meetings/:id/roles', (req) => meetings.setRoles(actor(req), req.params.id, req.body ?? {}))
  .on('POST', '/api/v1/meetings/:id/protocol/approve', (req) => meetings.approveProtocol(actor(req), req.params.id))
  .on('POST', '/api/v1/meetings/:id/protocol-document', (req) => meetings.generateProtocol(actor(req), req.params.id))
  .on('PATCH', '/api/v1/resolutions/:id', (req) => meetings.updateResolution(actor(req), req.params.id, req.body ?? {}))
  .on('GET', '/api/v1/meetings/:id/resolutions', (req) => meetings.listResolutions(actor(req), req.params.id))
  .on('POST', '/api/v1/meetings/:id/resolutions', (req) => meetings.createResolution(actor(req), req.params.id, req.body ?? {}))
  .on('GET', '/api/v1/resolutions', (req) => meetings.listResolutions(actor(req), null))
  // server: open:true creates and opens in one go; a refused opening leaves no draft
  .on('POST', '/api/v1/resolutions', (req) => {
    const viewer = actor(req);
    const body = req.body ?? {};
    if (body.open && (typeof body.deadline !== 'string' || Date.parse(body.deadline) < Date.now() + meetings.circular.data.minHours * 3_600_000))
      fail(400, 'resolution.deadline-too-short');
    const created = meetings.createResolution(viewer, null, body);
    return body.open ? meetings.openResolution(viewer, created.id) : created;
  })
  .on('GET', '/api/v1/resolutions/all', (req) => meetings.allResolutions(actor(req), req.query.get('year')))
  .on('GET', '/api/v1/resolutions/:id', (req) => meetings.getResolution(actor(req), req.params.id))
  .on('DELETE', '/api/v1/resolutions/:id', (req) => meetings.deleteResolution(actor(req), req.params.id))
  .on('POST', '/api/v1/resolutions/:id/open', (req) => meetings.openResolution(actor(req), req.params.id, req.body?.mode ?? null))
  .on('POST', '/api/v1/resolutions/:id/close', (req) => meetings.closeResolution(actor(req), req.params.id))
  .on('PUT', '/api/v1/resolutions/:id/deadline', (req) => meetings.extendDeadline(actor(req), req.params.id, req.body?.deadline))
  .on('POST', '/api/v1/resolutions/:id/vote', (req) => meetings.vote(actor(req), req.params.id, req.body?.choice))
  .on('POST', '/api/v1/resolutions/:id/recorded-vote', (req) => meetings.recordVote(actor(req), req.params.id, req.body?.memberId, req.body?.choice))
  .on('POST', '/api/v1/resolutions/:id/analog-votes', (req) => meetings.analogVotes(actor(req), req.params.id, req.body ?? {}))
  .on('POST', '/api/v1/resolutions/:id/hand-result', (req) => meetings.analogVotes(actor(req), req.params.id, req.body ?? {}, true))
  .on('POST', '/api/v1/meetings/:id/invitation-document', (req) => meetings.generateInvitation(actor(req), req.params.id))
  .on('PUT', '/api/v1/resolutions/:id/links', (req) => meetings.setResolutionLinks(actor(req), req.params.id, req.body?.refs))
  .on('PUT', '/api/v1/resolutions/:id/assignees', (req) => meetings.setResolutionAssignees(actor(req), req.params.id, req.body ?? {}))
  .on('PUT', '/api/v1/meetings/:id/links', (req) => meetings.setLinks(actor(req), req.params.id, req.body?.refs))
  .on('PUT', '/api/v1/meetings/:id/presence/:memberId', (req) =>
    meetings.setPresence(actor(req), req.params.id, req.params.memberId, req.body?.present),
  );
