// Mock of the club-server meetings module (MeetingHandlers, MeetingTypeHandlers, MeetingType).
import { generatedKey } from '../../lib/mock/keys';
import { directory, MockDirectory } from '../../lib/mock/core';
import { MockServer, mockServer, type MockRequest } from '../../lib/mock/MockServer';
import { MockTable } from '../../lib/mock/MockTable';
import { resolveRef } from '../../lib/mock/recordRefs';
import { documents, files, meetingFolderRights } from '../files/mock';
import type { Values } from '../../lib/mock/wordTemplate';
import type { LinkedRef, RefKind } from '../../lib/records/refs';
import { ADMIN_BOARD, guestOnly, type Hue, type Member, type Role } from '../../lib/types';
import { HUES } from '../calendar/model';
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
  invitesVoters,
  quorumReached,
  SEEDED_CIRCULAR,
  type AgendaItem,
  type CallState,
  type CallTracksAnswer,
  type CircularRules,
  type ResolutionSummary,
  type ResolutionRules,
  type TaskFallback,
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
  type MajorityBase,
  quorumValid,
  protocolValid,
  DEFAULT_PROTOCOL,
  type ProtocolRules,
  type Invitees,
  type Voting,
  type Resolution,
  type VoteMode,
  type StepAnchor,
  type StepAudience,
} from './model';

const fail = MockServer.fail;
const DAY = 86_400_000;

const ANCHORS: readonly StepAnchor[] = ['BEFORE_INVITE', 'BEFORE_START', 'AFTER_END', 'AFTER_CREATE', 'AFTER_STEP'];
const AUDIENCES: readonly StepAudience[] = ['ELECTORATE', 'BOARD', 'CONVENERS', 'SECRETARY', 'OFFICE'];

/** server: MeetingStep record and MeetingTypeHandlers.steps. */
function checkedSteps(value: unknown): MeetingStep[] {
  if (value == null) return defaultSteps(false);
  if (!Array.isArray(value) || value.length > 30) return fail(400, 'meeting-step.too-many');
  const systems = new Set<string>();
  const steps = value.map((s: Record<string, any>): MeetingStep => {
    if (!ANCHORS.includes(s.anchor) || !AUDIENCES.includes(s.audience) || (s.action !== 'NOTIFICATION' && s.action !== 'TASK'))
      fail(400, 'meeting-step.invalid');
    if (!Number.isInteger(s.offsetHours) || s.offsetHours < 0 || s.offsetHours > 8760) fail(400, 'meeting-step.offset-invalid');
    // server: MeetingStep — an office exactly for OFFICE, one the club has (MeetingTypeHandlers)
    const office = s.audience === 'OFFICE' ? s.office : null;
    if ((s.audience === 'OFFICE') !== !!s.office) fail(400, 'meeting-step.invalid');
    if (office && !directory.boardSettings.data.offices.some((o) => o.office === office)) fail(400, 'meeting-step.invalid');
    const id: string = s.id ?? crypto.randomUUID();
    if ((s.anchor === 'AFTER_STEP') !== !!s.after || s.after === id) fail(400, 'meeting-step.after-invalid');
    if (s.system) {
      if (systems.has(s.system)) fail(400, 'meeting-step.invalid');
      systems.add(s.system);
      const own = s.system === 'INVITE_REMINDER' ? 'BEFORE_INVITE' : 'BEFORE_START';
      if (s.anchor !== own || s.action !== 'NOTIFICATION') fail(400, 'meeting-step.system-fixed');
      return {
        id,
        anchor: s.anchor,
        offsetHours: s.offsetHours,
        action: s.action,
        audience: s.audience,
        title: null,
        body: null,
        system: s.system,
        office: null,
        after: null,
      };
    }
    const title = text(s.title, 150, 'meeting-step.title-invalid') ?? fail(400, 'meeting-step.title-invalid');
    return {
      id,
      anchor: s.anchor,
      offsetHours: s.offsetHours,
      action: s.action,
      audience: s.audience,
      title,
      body: text(s.body, 1000, 'meeting-step.title-invalid'),
      system: null,
      office,
      after: s.anchor === 'AFTER_STEP' ? s.after : null,
    };
  });
  // server: MeetingTypeHandlers.steps — a step follows one of the same type, and no chain runs in a circle
  const previous = new Map(steps.map((s) => [s.id, s.after]));
  for (const s of steps) {
    let at = s.after;
    for (let hops = 0; at != null; hops++) {
      if (!previous.has(at) || hops >= steps.length) fail(400, 'meeting-step.after-invalid');
      at = previous.get(at) ?? null;
    }
  }
  return steps;
}

const BASES: readonly MajorityBase[] = ['VALID', 'CAST', 'PRESENT'];
const INVITEES: readonly Invitees[] = ['BOARD', 'VOTERS', 'BOARD_AND_VOTERS', 'CHOSEN'];
const VOTINGS: readonly Voting[] = ['ALL_INVITED', 'VOTERS_ONLY'];
const text = (value: unknown, max: number, code: string): string | null => {
  if (value == null) return null;
  const t = String(value).trim();
  if (t.length > max) fail(400, code);
  return t || null;
};

export class MockMeetings {
  /** server: meetings_setting */
  /** The resolution rules: the circular ones plus the task fallback (server: meetings_setting). */
  readonly circular = new MockTable<CircularRules & { taskFallback: TaskFallback }>('circular-rules', () => ({
    ...SEEDED_CIRCULAR,
    taskFallback: 'BOARD',
  }));
  readonly types = new MockTable<StoredType[]>('meeting-types', () => structuredClone([...SEEDED_TYPES]));
  readonly meetings = new MockTable<StoredMeeting[]>('meetings', () => seedMeetings());
  readonly resolutions = new MockTable<StoredResolution[]>('resolutions', () => seedResolutions());
  /** meetingId → its folder and generated invitation (server: meetings_document). */
  readonly documents = new MockTable<Record<string, { folderId: string; fileId: string | null }>>('meeting-documents', () => ({}));
  /** server: meetings_type_folder — the MEETING folder of each chosen type. */
  readonly typeFolders = new MockTable<Record<string, string>>('meeting-type-folders', () => ({}));

  constructor(private readonly people: MockDirectory) {
    meetingFolderRights.of = (member) => this.folderRights(member);
    // server: the hourly reminder run gives every draft and open circular vote its deadline task
    for (const m of this.meetings.data.filter((x) => x.status === 'DRAFT')) this.inviteTask(m);
    for (const r of this.resolutions.data.filter((x) => !x.meetingId && x.status === 'OPEN')) this.circularTask(r, 'vorstand');
    mockServer.events.subscribe((event) => {
      const data = event.data as Record<string, any>;
      if (event.type === 'members.member-erased') {
        // server: MeetingRepository.dropMember
        for (const m of this.meetings.data) {
          m.invitees = m.invitees?.filter((id) => id !== data.memberId);
          m.guests = m.guests?.filter((id) => id !== data.memberId);
          m.parties = m.parties?.filter((id) => id !== data.memberId);
        }
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

  /** server: CircularRules.valid — 1 hour to 30 days, a quorum, at least one majority, a base, reminded 1 to 720 hours ahead. */
  saveRules(viewer: Member, body: Record<string, any>): ResolutionRules {
    this.people.requirePrivileged(viewer, ADMIN_BOARD);
    const c = body.circular as CircularRules | undefined;
    const hours = (v: unknown) => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 720;
    if (
      !c ||
      !hours(c.minHours) ||
      !hours(c.remindHours) ||
      !c.quorum ||
      !quorumValid(c.quorum) ||
      !Array.isArray(c.majorities) ||
      !c.majorities.length ||
      !c.majorities.every((m) => ALL_MAJORITIES.includes(m)) ||
      !BASES.includes(c.majorityBase)
    )
      fail(400, 'resolution-rules.circular-invalid');
    if (body.taskFallback != null && !['BOARD', 'CHAIR'].includes(body.taskFallback)) fail(400, 'request.invalid');
    Object.assign(this.circular.data, {
      minHours: c!.minHours,
      quorum: c!.quorum,
      majorities: [...new Set(c!.majorities)],
      majorityBase: c!.majorityBase,
      remindHours: c!.remindHours,
      taskFallback: body.taskFallback ?? 'BOARD',
    });
    this.circular.save();
    mockServer.events.publish({ type: 'meetings.resolution-rules-changed', data: {}, audience: { everyone: true } });
    return this.rules();
  }

  rules(): ResolutionRules {
    const { taskFallback, ...circular } = this.circular.data;
    return { circular, taskFallback };
  }

  private name(id: string): string {
    const p = this.people.members.data.find((x) => x.id === id);
    return p ? `${p.firstName} ${p.lastName}` : '–';
  }

  /** server: RecordRefs.resolve — new links as the viewer sees them, kept ones stay. */
  private resolvedLinks(viewer: Member, kept: readonly LinkedRef[], refs: unknown[], code: 'meeting' | 'resolution'): LinkedRef[] {
    return (refs as { kind: RefKind; id: string }[]).map(
      (ref) =>
        kept.find((k) => k.kind === ref.kind && k.id === ref.id) ??
        resolveRef(viewer, ref, code, (other) => {
          const m = this.meetings.data.find((x) => x.id === other);
          return m && this.maySee(viewer, m) ? m.title : null;
        }),
    );
  }

  setResolutionLinks(viewer: Member, id: string, refs: unknown): Resolution {
    const r = this.managedResolution(viewer, id);
    if (!Array.isArray(refs) || refs.length > 30) return fail(400, 'resolution.too-many-refs');
    r.links = this.resolvedLinks(viewer, r.links ?? [], refs, 'resolution');
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

  /** server: Resolution.majorityFor — the requested one if allowed (the meeting's type, else the circular rules), else simple where allowed, else the lowest. */
  private majorityFor(type: MeetingType | null, requested: unknown): Majority {
    const allowed = majorities(type ? type.majorities : this.circular.data.majorities);
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
    // Kept items keep their protocol.
    const minutes = new Map((meeting.agendaItems ?? []).map((i) => [i.id, i.minutes ?? null]));
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
      return { id: i.id ?? crypto.randomUUID(), title, note: String(i.note ?? '').trim() || null, resolutionId, minutes: minutes.get(i.id) ?? null };
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
      status: 'DRAFT',
      invitedAt: null,
      openedAt: null,
      closedAt: null,
      protocol: null,
      createdBy: viewer.id,
      createdAt: new Date().toISOString(),
      presence: {},
      links: [],
      ...(type.invitees === 'CHOSEN' ? { invitees: [], guests: [], parties: [] } : {}),
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
    const details = ['title', 'urgency', 'startsAt', 'endsAt', 'location'].some((k) => body[k] != null);
    if (details && meeting.status === 'CLOSED') fail(409, 'meeting.closed');
    const moves = (body.startsAt && body.startsAt !== meeting.startsAt) || (body.endsAt && body.endsAt !== meeting.endsAt);
    if (moves && meeting.status !== 'DRAFT') fail(409, 'meeting.invited-time-fixed');
    if (body.protocol != null || body.minutes != null) {
      if (meeting.status !== 'OPEN' && meeting.status !== 'CLOSED') fail(409, 'meeting.protocol-not-yet');
      if (this.protocolFinalAt(meeting)) fail(409, 'meeting.protocol-final');
      if (body.protocol != null && String(body.protocol).length > 100000) fail(400, 'meeting.protocol-too-long');
    }
    if (body.minutes != null) {
      // server: MeetingHandlers.saveMinutes — items of other meetings are refused, an empty text clears
      const given = new Map<string, string | null>(
        (body.minutes as { agendaItemId: string; text: string | null }[]).map((i) => [i.agendaItemId, i.text?.trim() || null]),
      );
      const items = meeting.agendaItems ?? [];
      if ([...given.keys()].some((id) => !items.some((i) => i.id === id))) fail(400, 'meeting.agenda-invalid');
      meeting.agendaItems = items.map((i) => (given.has(i.id!) ? { ...i, minutes: given.get(i.id!)! } : i));
    }
    if (typeof body.location === 'string' && body.location.length > 200) fail(400, 'meeting.location-too-long');
    const before = { Titel: meeting.title, Tagesordnung: meeting.agenda, Ort: meeting.location };
    this.apply(meeting, body);
    const after = { Titel: meeting.title, Tagesordnung: meeting.agenda, Ort: meeting.location };
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
    if (this.type(meeting.kind).invitees === 'CHOSEN') this.requireInviteeCount(meeting, (meeting.invitees ?? []).length);
    meeting.status = 'INVITED';
    meeting.invitedAt = new Date().toISOString();
    this.changed(meeting, 'INVITED');
    mockServer.events.publish({
      type: 'meetings.meeting-invited',
      data: {
        meetingId: meeting.id,
        recipients: this.invited(meeting),
        kind: meeting.kind,
        title: meeting.title,
        items: this.invitedItems(meeting),
        startsAt: meeting.startsAt,
        location: meeting.location,
        online: this.type(meeting.kind).online,
      },
    });
    return this.dto(viewer, meeting);
  }

  /** server: MeetingHandlers.invitedItems — every item, Beschlüsse with their text. */
  private invitedItems(meeting: StoredMeeting): { title: string; resolution: boolean; motion: string | null }[] {
    return (meeting.agendaItems ?? []).map((i) => {
      const r = i.resolutionId ? this.resolutions.data.find((x) => x.id === i.resolutionId) : undefined;
      return { title: i.title, resolution: !!r, motion: r?.text ?? null };
    });
  }

  open(viewer: Member, id: string): Meeting {
    const meeting = this.managed(viewer, id);
    if (meeting.status !== 'INVITED') fail(409, 'meeting.not-invited');
    Object.assign(meeting, { status: 'OPEN', openedAt: new Date().toISOString(), frozenElectorate: this.electorate(meeting) });
    this.changed(meeting, 'OPENED');
    this.notice(
      this.meetingInvited(meeting),
      `Sitzung eröffnet: ${meeting.title}`,
      this.type(meeting.kind).online ? 'Die Sitzung hat begonnen. Die Videokonferenz läuft in der App.' : 'Die Sitzung hat begonnen.',
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
    this.notice(this.meetingInvited(meeting), `Sitzung beendet: ${meeting.title}`, 'Beschlüsse und Protokoll sind in der App.', `/meetings/${id}`);
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
      data: {
        meetingId: meeting.id,
        recipients: this.meetingInvited(meeting),
        title: meeting.title,
        startsAt: meeting.startsAt,
      },
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
    this.notice(this.meetingInvited(meeting), `Geändert: ${meeting.title}`, `Geändert: ${what.join(', ')}.`, `/meetings/${meeting.id}`);
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

  /**
   * server: CallHandlers — the call state per meeting, in memory. shortcut: the browser mock has no SFU, so tracks are answered empty and
   * two other people present appear as joined without video; enough to see the call's layout, not its media.
   */
  private readonly calls = new Map<string, Map<string, string>>();

  joinCall(viewer: Member, id: string): CallState {
    const meeting = this.callable(viewer, id);
    const call = this.calls.get(id) ?? new Map<string, string>();
    this.calls.set(id, call);
    const others = Object.keys(meeting.presence).filter((m) => meeting.presence[m] && m !== viewer.id);
    others.slice(0, 2).forEach((m) => call.has(m) || call.set(m, `mock-${m}`));
    call.set(viewer.id, `mock-${viewer.id}-${Date.now()}`);
    return this.callState(viewer, id);
  }

  callState(viewer: Member, id: string): CallState {
    this.visible(viewer, id);
    const call = this.calls.get(id) ?? new Map<string, string>();
    return {
      sessionId: call.get(viewer.id) ?? null,
      participants: [...call].map(([memberId, sessionId]) => ({ memberId, name: this.name(memberId), sessionId, trackNames: [] })),
    };
  }

  leaveCall(viewer: Member, id: string): void {
    this.visible(viewer, id);
    this.calls.get(id)?.delete(viewer.id);
  }

  callTracks(viewer: Member, id: string): CallTracksAnswer {
    this.callable(viewer, id);
    if (!this.calls.get(id)?.has(viewer.id)) fail(409, 'meeting.call-not-joined');
    return { requiresImmediateRenegotiation: false, sessionDescription: null, tracks: [] };
  }

  /** server: CallHandlers.requireOpen — online types only, from an hour before the start while invited, and while open. */
  private callable(viewer: Member, id: string): StoredMeeting {
    const meeting = this.visible(viewer, id);
    if (!this.type(meeting.kind).online) fail(409, 'meeting.call-off');
    const soon = Date.parse(meeting.startsAt) - Date.now() <= 60 * 60_000;
    if (!(meeting.status === 'OPEN' || (meeting.status === 'INVITED' && soon))) fail(409, 'meeting.call-closed');
    return meeting;
  }

  /** server: MeetingHandlers.approveProtocol — chair and secretary, once each, after it is final. */
  approveProtocol(viewer: Member, id: string): Meeting {
    const meeting = this.visible(viewer, id);
    if (!this.protocolFinalAt(meeting)) fail(409, 'meeting.protocol-not-final');
    // server: the meeting's Vorsitz and Schriftführer:in; without a pick the office holders
    const offices = this.offices(viewer);
    const approvers = this.type(meeting.kind).protocol.approvers;
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
    if (!approvers.includes(office)) fail(403, 'meeting.approve-not-allowed');
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
    // server: guests take no role
    const guest = (id: string | null) => !!id && (meeting.guests ?? []).includes(id);
    if ((chair && (!meeting.presence[chair] || guest(chair))) || (secretary && (!meeting.presence[secretary] || guest(secretary))))
      fail(400, 'meeting.role-not-present');
    if (chair && chair === secretary) fail(400, 'meeting.roles-same');
    Object.assign(meeting, { chairId: chair, secretaryId: secretary });
    this.changed(meeting, 'UPDATED');
    return this.dto(viewer, meeting);
  }

  /** server: MeetingHandlers.setInvitees — members, guests (GUEST accounts) and parties until it opens; newcomers get the invitation, removed ones the cancellation. */
  setInvitees(viewer: Member, id: string, body: Record<string, any>): Meeting {
    const meeting = this.managed(viewer, id);
    if (this.type(meeting.kind).invitees !== 'CHOSEN') fail(409, 'meeting.invitees-not-chosen');
    if (meeting.status !== 'DRAFT' && meeting.status !== 'INVITED') fail(409, 'meeting.invitees-fixed');
    const ids = (v: unknown): string[] =>
      Array.isArray(v) && v.every((x) => typeof x === 'string') ? [...new Set(v as string[])] : fail(400, 'meeting.invitees-invalid');
    const memberIds = ids(body.memberIds ?? []);
    const partyIds = ids(body.partyIds ?? []);
    if ([...memberIds, ...partyIds].some((m) => !this.people.name(m))) fail(400, 'meeting.invitees-invalid');
    if (memberIds.some((m) => partyIds.includes(m))) fail(409, 'meeting.invitee-is-party');
    if (!Array.isArray(body.guests)) fail(400, 'meeting.invitees-invalid');
    const given = body.guests as Record<string, unknown>[];
    if (given.some((g) => g.id != null && !(meeting.guests ?? []).includes(g.id as string))) fail(400, 'meeting.invitees-invalid');
    const invited = meeting.status === 'INVITED';
    if (invited) this.requireInviteeCount(meeting, memberIds.length + given.length);
    // server: MembersApi.INVITE_GUEST — new guests get their account first
    const guestIds = given.map(
      (g) => (g.id as string | null) ?? this.people.inviteGuest({ email: g.email, firstName: g.firstName, lastName: g.lastName }).id,
    );
    if (new Set(guestIds).size !== guestIds.length || guestIds.some((g) => memberIds.includes(g))) fail(400, 'meeting.invitees-invalid');
    if (guestIds.some((g) => partyIds.includes(g))) fail(409, 'meeting.invitee-is-party');
    const before = meeting.invitees ?? [];
    const now = [...memberIds, ...guestIds];
    Object.assign(meeting, { invitees: now, guests: guestIds, parties: partyIds });
    this.changed(meeting, 'UPDATED');
    const added = now.filter((m) => !before.includes(m));
    const dropped = before.filter((m) => !now.includes(m));
    if (invited && added.length)
      mockServer.events.publish({
        type: 'meetings.meeting-invited',
        data: {
          meetingId: meeting.id,
          recipients: added,
          kind: meeting.kind,
          title: meeting.title,
          items: this.invitedItems(meeting),
          startsAt: meeting.startsAt,
          location: meeting.location,
          online: this.type(meeting.kind).online,
        },
      });
    if (invited && dropped.length)
      mockServer.events.publish({
        type: 'meetings.meeting-cancelled',
        data: { meetingId: meeting.id, recipients: dropped, title: meeting.title, startsAt: meeting.startsAt },
      });
    return this.dto(viewer, meeting);
  }

  /** server: MeetingAccess.requireInviteeCount — the type's bounds. */
  private requireInviteeCount(meeting: StoredMeeting, count: number): void {
    const type = this.type(meeting.kind);
    if (count < (type.minInvitees ?? 1) || (type.maxInvitees != null && count > type.maxInvitees)) fail(409, 'meeting.invitees-count');
  }

  /** Whoever leaves the presence gives up the role. */
  private dropRolesOfAbsent(meeting: StoredMeeting): void {
    if (meeting.chairId && !meeting.presence[meeting.chairId]) meeting.chairId = null;
    if (meeting.secretaryId && !meeting.presence[meeting.secretaryId]) meeting.secretaryId = null;
  }

  /** server: MeetingHandlers.generateProtocol — the club's protocol template filled, a new file in the meeting's folder each time. */
  async generateProtocol(viewer: Member, id: string): Promise<Meeting> {
    const meeting = this.managed(viewer, id);
    if (meeting.status !== 'CLOSED') fail(409, 'meeting.not-closed');
    const content = await documents.render(viewer, 'PROTOCOL_TEMPLATE', { ...this.values(meeting), ...this.protocolValues(viewer, meeting) });
    const stored = this.documents.data[id];
    const folderId = this.meetingFolder(viewer, meeting, stored?.folderId);
    const file = await this.upload(viewer, folderId, new File([content], `Protokoll ${this.day(meeting)} ${meeting.title}.docx`));
    // The meeting keeps its folder; the stored invitation stays its document.
    return this.linkFirst(viewer, meeting, file.id, folderId, { folderId, fileId: stored?.fileId ?? null });
  }

  private protocolFinalAt(m: StoredMeeting): string | null {
    return m.protocolFinalAt ?? null;
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
    if ((refs as { kind: RefKind; id: string }[]).some((ref) => ref?.kind === 'MEETING' && ref.id === id)) fail(400, 'meeting.ref-unknown');
    meeting.links = this.resolvedLinks(viewer, meeting.links ?? [], refs, 'meeting');
    this.changed(meeting, 'UPDATED');
    return this.dto(viewer, meeting);
  }

  /** server: MeetingHandlers.generateInvitation + InvitationDocuments — again = a new version of the same file. */
  async generateInvitation(viewer: Member, id: string): Promise<Meeting> {
    const meeting = this.managed(viewer, id);
    const own = this.resolutions.data.filter((r) => r.meetingId === id);
    const content = await documents.render(viewer, 'INVITATION_TEMPLATE', {
      ...this.values(meeting),
      Dringlichkeit: meeting.urgency,
      Versandt: this.format(meeting.invitedAt ?? new Date().toISOString(), { dateStyle: 'long' }),
      // server: MeetingHandlers.documentItems
      Punkte: (meeting.agendaItems ?? []).map((i, k) => ({
        Nummer: String(k + 1),
        Titel: i.title,
        Notiz: i.note,
        Antrag: own.find((r) => r.id === i.resolutionId)?.text ?? null,
      })),
    });
    const stored = this.documents.data[id];
    const folderId = this.meetingFolder(viewer, meeting, stored?.folderId);
    let fileId: string;
    if (stored?.fileId && files.files.data.some((f) => f.id === stored.fileId)) {
      const form = new FormData();
      form.append('file', new File([content], 'einladung.docx'));
      form.append('label', this.format(new Date().toISOString(), { dateStyle: 'short', timeStyle: 'medium' }).replace(',', ''));
      form.append('date', this.people.clock.today());
      form.append('note', 'Neu erstellt'); // server: texts document.regenerated
      fileId = (await files.uploadVersion({ params: { id: stored.fileId }, query: new URLSearchParams(), body: form, email: viewer.email } as never))
        .id;
    } else {
      fileId = (await this.upload(viewer, folderId, new File([content], `Einladung ${this.day(meeting)} ${meeting.title}.docx`))).id;
    }
    return this.linkFirst(viewer, meeting, fileId, folderId, { folderId, fileId });
  }

  // --- documents (server: InvitationDocuments) ---

  private format(iso: string, options: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat('de-AT', { timeZone: this.people.club.timeZone, ...options }).format(new Date(iso));
  }

  /** "Mittwoch, 5. November 2026, 18:00 bis 20:00 Uhr" */
  private when(m: StoredMeeting): string {
    const time = (iso: string) => this.format(iso, { timeStyle: 'short' });
    return `${this.format(m.startsAt, { dateStyle: 'full' })}, ${time(m.startsAt)} bis ${time(m.endsAt)} Uhr`;
  }

  /** The meeting's day in the club's time zone. */
  private day(m: StoredMeeting): string {
    return this.people.clock.localDate(m.startsAt);
  }

  private upload(viewer: Member, folderId: string, file: File) {
    const form = new FormData();
    form.append('file', file);
    return files.upload({ params: { folderId }, query: new URLSearchParams(), body: form, email: viewer.email } as never);
  }

  private topFolder(viewer: Member, name: string, scope: 'ASSEMBLY' | 'BOARD') {
    return (
      files.listFolders(viewer).find((f) => !f.parentId && f.name === name && f.scope === scope) ??
      files.createFolder(viewer, { name, kind: 'DOCUMENTS', scope, teamIds: [] })
    );
  }

  /** server: InvitationDocuments.values — what invitation and protocol share; `Titel` only when it differs from the type's name. */
  private values(m: StoredMeeting): Values {
    const type = this.type(m.kind);
    const time = (iso: string) => this.format(iso, { timeStyle: 'short' });
    return {
      Art: type.invitationLabel,
      Sitzung: m.title,
      Titel: m.title.toLowerCase() === type.label.toLowerCase() ? null : m.title,
      Datum: this.format(m.startsAt, { dateStyle: 'long' }),
      Beginn: time(m.startsAt),
      Ende: time(m.endsAt),
      Wann: this.when(m),
      Ort: m.location,
      Online: type.online ? 'In der App' : null,
    };
  }

  /** server: MeetingHandlers.protocolValues — who was there, each item with its protocol and vote, the tasks of passed Beschlüsse. */
  private protocolValues(viewer: Member, m: StoredMeeting): Values {
    const dto = this.dto(viewer, m);
    const present = new Set(dto.present.map((p) => p.memberId));
    const names = (ids: readonly { name: string }[]) => ids.map((p) => p.name).join(', ');
    const own = this.resolutions.data.filter((r) => r.meetingId === m.id);
    const day = (iso: string) => this.format(iso, { day: 'numeric', month: 'numeric', year: 'numeric' });
    const items = (m.agendaItems ?? []).map((i) => [i, own.find((r) => r.id === i.resolutionId)] as const);
    return {
      Vorsitz: dto.chair?.name ?? null,
      Schriftführer: dto.secretary?.name ?? null,
      Anwesend: names(dto.present),
      Abwesend: names(dto.electorate.filter((p) => !present.has(p.memberId))),
      Gäste: (m.guests ?? []).map((g) => this.name(g)).join(', ') || null,
      AnzahlAnwesend: String(dto.present.length),
      AnzahlStimmberechtigt: String(dto.electorate.length),
      // server: MeetingAccess.wasQuorate — judged at the closing, the status no longer counts
      Beschlussfähig: isQuorate(
        this.type(m.kind),
        dto.present.filter((p) => dto.electorate.some((e) => e.memberId === p.memberId)).length,
        dto.electorate.length,
        m.startsAt,
        m.closedAt ? Date.parse(m.closedAt) : Date.now(),
      )
        ? 'ja'
        : 'nein',
      Punkte: items.map(([i, r], k) => ({
        Nummer: String(k + 1),
        Titel: i.title,
        Protokoll: i.minutes ?? null,
        Beschluss: r ? [this.protocolVote(r)] : [],
      })),
      Aufgaben: items
        .filter(([, r]) => r?.result === 'PASSED')
        .map(([, r]) => ({
          Aufgabe: r!.title,
          Verantwortlich: (r!.assigneeIds ?? [])
            .map((a) => this.name(a))
            .sort()
            .join(', '),
          Bis: r!.implementDue ? day(`${r!.implementDue}T12:00:00Z`) : null,
        })),
      Notizen: m.protocol,
      Freigaben: dto.approvals.map((a) => `${a.name}, ${day(a.at)}`).join('\n'),
    };
  }

  /** server: MeetingHandlers.vote — app ballots plus a show of hands. */
  private protocolVote(r: StoredResolution): Values {
    const RESULT = { PASSED: 'angenommen', FAILED: 'abgelehnt', NOT_QUORATE: 'ohne ausreichende Beteiligung' } as const;
    const MAJORITY = { SIMPLE: 'einfache Mehrheit', TWO_THIRDS: 'Zweidrittelmehrheit', THREE_QUARTERS: 'Dreiviertelmehrheit' } as const;
    const counted = r.result != null;
    return {
      Antrag: r.text ?? r.title,
      Ergebnis: r.result ? RESULT[r.result] : 'nicht abgestimmt',
      Ja: counted ? String(r.yes + (r.analogYes ?? 0)) : null,
      Nein: counted ? String(r.no + (r.analogNo ?? 0)) : null,
      Enthaltung: counted ? String(r.abstain + (r.analogAbstain ?? 0)) : null,
      Mehrheit: MAJORITY[r.majority],
      Modus: r.voteMode === 'HAND' ? 'Handzeichen' : r.voteMode === 'APP' ? 'in der App' : null,
    };
  }

  /** The meeting's own folder below "Mitgliederversammlungen" or "Vorstandssitzungen", created on first use. */
  private meetingFolder(viewer: Member, meeting: StoredMeeting, storedFolderId: string | undefined): string {
    if (storedFolderId && files.listFolders(viewer).some((f) => f.id === storedFolderId)) return storedFolderId;
    const type = this.type(meeting.kind);
    if (type.invitees === 'CHOSEN') {
      // server: InvitationDocuments — a MEETING folder per type, one per meeting below it
      let parent = this.typeFolders.data[type.key];
      if (!parent || !files.folders.data.some((f) => f.id === parent)) {
        parent = files.createMeetingFolder(null, type.label);
        this.typeFolders.data[type.key] = parent;
        this.typeFolders.save();
      }
      const folderId = files.createMeetingFolder(parent, `${this.day(meeting)} ${meeting.title}`.slice(0, 100));
      // registered before the upload: the folder's rights come from it
      this.documents.data[meeting.id] = { folderId, fileId: null };
      this.documents.save();
      return folderId;
    }
    const assembly = invitesVoters(this.type(meeting.kind));
    const parent = this.topFolder(viewer, assembly ? 'Mitgliederversammlungen' : 'Vorstandssitzungen', assembly ? 'ASSEMBLY' : 'BOARD');
    return files.createFolder(viewer, { parentId: parent.id, name: `${this.day(meeting)} ${meeting.title}`.slice(0, 100), kind: 'DOCUMENTS' }).id;
  }

  /** server: MeetingHandlers.linkFirst — remembers the meeting's document and puts the written file first in its links. */
  private linkFirst(
    viewer: Member,
    meeting: StoredMeeting,
    fileId: string,
    folderId: string,
    keep: { folderId: string; fileId: string | null },
  ): Meeting {
    this.documents.data[meeting.id] = keep;
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
    const meeting = meetingId ? this.managed(viewer, meetingId) : null;
    if (!meeting && !this.runsCircular(viewer)) fail(403, 'access.denied');
    if (meeting?.status === 'CLOSED' || meeting?.status === 'CANCELLED') fail(409, 'meeting.closed');
    if (meeting && (meeting.agendaItems ?? []).length >= 50) fail(400, 'meeting.agenda-invalid'); // the agenda's own limit
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
      this.setItems(meeting, [...(meeting.agendaItems ?? []), { id: crypto.randomUUID(), title, note: null, resolutionId: r.id, minutes: null }]);
      this.meetings.save();
      this.noticeChange(meeting, ['Tagesordnung']); // like an agenda edit
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
  allResolutions(viewer: Member, year: string | null): { items: ResolutionSummary[]; truncated: boolean } {
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
    return { items: items.slice(0, 500), truncated: items.length > 500 }; // server: ResolutionHandlers.MAX_ALL
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
    const meetingType = r.meetingId ? this.type(this.meetings.data.find((m) => m.id === r.meetingId)!.kind) : null;
    const base = meetingType ? meetingType.majorityBase : this.circular.data.majorityBase;
    const yes = r.yes + (r.analogYes ?? 0);
    const valid = yes + r.no + (r.analogNo ?? 0);
    const counted =
      base === 'VALID' ? valid : base === 'CAST' ? valid + r.abstain + (r.analogAbstain ?? 0) : r.meetingId ? this.presentVoters(r) : (r.voters ?? 0);
    const passes =
      counted > 0 && (r.majority === 'SIMPLE' ? yes * 2 > counted : r.majority === 'TWO_THIRDS' ? yes * 3 >= counted * 2 : yes * 4 >= counted * 3);
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

  /** server: ResolutionTasks.passed — the task "<Titel> umsetzen" for the named active members, else the club's task fallback. */
  private passed(r: StoredResolution, meeting: StoredMeeting | null): void {
    const named = (r.assigneeIds ?? []).filter((id) => this.people.members.data.some((m) => m.id === id && m.active));
    const chairs =
      this.circular.data.taskFallback === 'CHAIR'
        ? this.people
            .running()
            .filter((o) => o.office === 'CHAIR')
            .map((o) => o.memberId)
        : [];
    const assignees = named.length ? named : chairs.length ? chairs : this.people.electorate('BOARD').slice(0, 30);
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
    return this.runs(
      viewer,
      this.meetings.data.find((m) => m.id === r.meetingId)!,
    );
  }

  private managedResolution(viewer: Member, id: string): StoredResolution {
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

  /** server: MeetingAccess.audience — an invited general meeting reaches everyone invited, everything else admin and board. */
  private audience(m: StoredMeeting): { members?: string[]; roles: Role[] } {
    if (this.type(m.kind).invitees === 'CHOSEN') return { members: m.status === 'DRAFT' ? [] : this.invited(m), roles: ['ADMIN'] };
    return invitesVoters(this.type(m.kind)) && m.status !== 'DRAFT'
      ? { members: this.meetingInvited(m), roles: [...ADMIN_BOARD] }
      : { roles: [...ADMIN_BOARD] };
  }

  private resolutionChanged(r: StoredResolution, change: string): void {
    this.resolutions.save();
    const meeting = r.meetingId ? this.meetings.data.find((m) => m.id === r.meetingId) : null;
    mockServer.events.publish({
      type: 'meetings.resolution-changed',
      data: { resolutionId: r.id, meetingId: r.meetingId, change },
      audience: meeting ? this.audience(meeting) : { roles: ADMIN_BOARD },
    });
  }

  /** server: Meeting record validation */
  private apply(m: StoredMeeting, body: Record<string, any>): void {
    if (body.title !== undefined) m.title = text(body.title, 120, 'meeting.title-invalid') ?? fail(400, 'meeting.title-invalid');
    if (body.urgency !== undefined) m.urgency = text(body.urgency, 1000, 'meeting.urgency-invalid');
    if (body.location !== undefined) m.location = text(body.location, 200, 'meeting.location-too-long');
    if (body.protocol !== undefined) m.protocol = text(body.protocol, 100000, 'meeting.protocol-too-long');
    if (body.startsAt) m.startsAt = new Date(body.startsAt).toISOString();
    if (body.endsAt) m.endsAt = new Date(body.endsAt).toISOString();
    if (!m.startsAt || !m.endsAt || m.endsAt <= m.startsAt) fail(400, 'meeting.times-invalid');
    if (Date.parse(m.endsAt) - Date.parse(m.startsAt) > this.type(m.kind).maxDays * DAY) fail(400, 'meeting.too-long');
    if (this.type(m.kind).needsReason !== !!m.urgency) fail(400, 'meeting.urgency-invalid');
    this.meetings.save();
  }

  /** server: MeetingAccess.invited — the board, the members with a vote, both, or the members chosen for the meeting. */
  private invited(m: StoredMeeting): string[] {
    const { invitees } = this.type(m.kind);
    if (invitees === 'CHOSEN') return [...(m.invitees ?? [])];
    const board = invitees === 'VOTERS' ? [] : this.people.electorate('BOARD');
    const voters = invitees === 'BOARD' ? [] : this.people.electorate('ASSEMBLY');
    return [...new Set([...board, ...voters])];
  }

  /** server: MeetingAccess.voters — all invited, or only those whose membership kind votes. */
  private electorate(m: StoredMeeting): string[] {
    const invited = this.invited(m);
    const type = this.type(m.kind);
    if (type.voting === 'ALL_INVITED') return invited;
    const withVote = new Set(this.people.electorate('ASSEMBLY'));
    return invited.filter((id) => withVote.has(id));
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
    if (!INVITEES.includes(body.invitees) || !VOTINGS.includes(body.voting)) fail(400, 'meeting-type.electorate-invalid');
    if (!Number.isInteger(body.noticeHours) || body.noticeHours < 0 || body.noticeHours > 8760) fail(400, 'meeting-type.notice-invalid');
    if (!body.quorum || !quorumValid(body.quorum)) fail(400, 'meeting-type.quorum-invalid');
    if (body.majorityBase != null && !BASES.includes(body.majorityBase)) fail(400, 'request.invalid');
    if (body.protocol != null && !Array.isArray(body.protocol.approvers)) fail(400, 'meeting-type.protocol-invalid');
    const protocol: ProtocolRules = body.protocol
      ? {
          approvers: [...new Set(body.protocol.approvers as ProtocolRules['approvers'])],
          approvalsNeeded: body.protocol.approvalsNeeded,
          readers: body.protocol.readers,
        }
      : { ...DEFAULT_PROTOCOL, approvers: [...DEFAULT_PROTOCOL.approvers] };
    if (!['INVITED', 'ALL_MEMBERS'].includes(protocol.readers) || !protocolValid(protocol, body.invitees)) fail(400, 'meeting-type.protocol-invalid');
    if (body.graceMinutes != null && (!Number.isInteger(body.graceMinutes) || body.graceMinutes < 1 || body.graceMinutes > 1440))
      fail(400, 'meeting-type.grace-invalid');
    // server: MeetingType — 1 to 30 days; colour from the calendar's, by default blue for general meetings
    const maxDays = body.maxDays ?? 1;
    if (!Number.isInteger(maxDays) || maxDays < 1 || maxDays > 30) fail(400, 'meeting-type.max-days-invalid');
    const hue: Hue = body.hue ?? (body.invitees === 'VOTERS' || body.invitees === 'BOARD_AND_VOTERS' ? 'blue' : 'purple');
    if (!HUES.includes(hue)) fail(400, 'meeting-type.hue-invalid');
    if (!majorities.length) fail(400, 'meeting-type.majorities-missing');
    if (!conveners.length) fail(400, 'meeting-type.conveners-invalid');
    const dueBy = body.dueBy || null;
    if (dueBy && (!/^\d{2}-\d{2}$/.test(dueBy) || !isDayOfYear(Number(dueBy.slice(0, 2)), Number(dueBy.slice(3)))))
      fail(400, 'meeting-type.due-by-invalid');
    const chosen = body.invitees === 'CHOSEN';
    const bound = (v: unknown): number | null =>
      v == null
        ? null
        : Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 50
          ? (v as number)
          : fail(400, 'meeting-type.invitees-invalid');
    const minInvitees = chosen ? bound(body.minInvitees) : null;
    const maxInvitees = chosen ? bound(body.maxInvitees) : null;
    if (minInvitees != null && maxInvitees != null && minInvitees > maxInvitees) fail(400, 'meeting-type.invitees-invalid');
    const before = this.types.data.find((t) => t.key === key);
    if (before && (before.invitees === 'CHOSEN') !== chosen && this.meetings.data.some((m) => m.kind === key))
      fail(409, 'meeting-type.invitees-in-use');
    const type: StoredType = {
      key: key ?? generatedKey('TYPE'),
      label,
      invitationLabel,
      invitees: body.invitees,
      voting: body.voting,
      minInvitees,
      maxInvitees,
      noticeHours: body.noticeHours,
      quorum: {
        numerator: body.quorum.numerator,
        denominator: body.quorum.denominator,
        moreThan: !!body.quorum.moreThan,
        minimum: body.quorum.minimum ?? null,
      },
      graceMinutes: body.graceMinutes ?? null,
      majorities,
      majorityBase: body.majorityBase ?? 'VALID',
      protocol,
      boardSeesDrafts: body.boardSeesDrafts !== false,
      maxDays,
      hue,
      conveners,
      needsReason: !!body.needsReason,
      dueBy,
      sort: Number.isInteger(body.sort) ? body.sort : 0,
      archived: !!body.archived,
      online: !!body.online,
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
    mockServer.events.publish({ type: 'meetings.meeting-types-changed', data: {}, audience: { everyone: true } });
  }

  /** server: MeetingAccess.electorate — fixed when the meeting opened. */
  private meetingVoters(m: StoredMeeting): string[] {
    return (m.status === 'OPEN' || m.status === 'CLOSED') && m.frozenElectorate?.length ? m.frozenElectorate : this.electorate(m);
  }

  /** server: MeetingAccess.invited(Meeting) — everyone invited now, and once opened also the electorate fixed then. */
  private meetingInvited(m: StoredMeeting): string[] {
    if (this.type(m.kind).invitees === 'CHOSEN') return this.invited(m);
    return [...new Set([...this.invited(m), ...(m.status === 'OPEN' || m.status === 'CLOSED' ? (m.frozenElectorate ?? []) : [])])];
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

  /** server: FileAccess for MEETING folders — type folders for who may convene, a meeting's folder for who sees or runs it. */
  private folderRights(viewer: Member): { visible: Set<string>; managed: Set<string> } {
    const visible = new Set<string>();
    const managed = new Set<string>();
    for (const [key, folderId] of Object.entries(this.typeFolders.data)) {
      if (!this.types.data.some((t) => t.key === key)) continue;
      if (this.mayConvene(viewer, key)) [visible, managed].forEach((s) => s.add(folderId));
      else if (this.meetings.data.some((m) => m.kind === key && this.documents.data[m.id] && this.maySee(viewer, m))) visible.add(folderId);
    }
    for (const m of this.meetings.data) {
      const folderId = this.documents.data[m.id]?.folderId;
      if (!folderId || this.type(m.kind).invitees !== 'CHOSEN' || !this.maySee(viewer, m)) continue;
      visible.add(folderId);
      if (this.runs(viewer, m)) managed.add(folderId);
    }
    return { visible, managed };
  }

  private maySee(viewer: Member, m: StoredMeeting): boolean {
    // server: MeetingAccess.maySee — a chosen meeting only for its conveners and, once invited, its invitees; never for a party
    if (this.type(m.kind).invitees === 'CHOSEN')
      return (
        !(m.parties ?? []).includes(viewer.id) && (this.mayConvene(viewer, m.kind) || (m.status !== 'DRAFT' && this.invited(m).includes(viewer.id)))
      );
    const type = this.type(m.kind);
    // server: protocol readers ALL_MEMBERS show a meeting with a final protocol to every member (not guests)
    if (type.protocol.readers === 'ALL_MEMBERS' && this.protocolFinalAt(m) && !guestOnly(viewer.roles)) return true;
    // server: boardSeesDrafts false keeps drafts with the conveners and admins
    if (this.people.hasRole(viewer, ADMIN_BOARD)) return m.status !== 'DRAFT' || type.boardSeesDrafts || this.mayConvene(viewer, m.kind);
    // server: MeetingAccess.maySee — voters see a general meeting from its invitation on
    return invitesVoters(this.type(m.kind)) && viewer.voter && m.status !== 'DRAFT';
  }

  private visible(viewer: Member, id: string): StoredMeeting {
    const meeting = this.meetings.data.find((m) => m.id === id);
    return meeting && this.maySee(viewer, meeting) ? meeting : fail(404, 'meeting.not-found');
  }

  /** server: MeetingAccess.mayManage — conveners (admins always), the secretary's office (not for chosen people), and the picked Vorsitz. */
  private runs(viewer: Member, m: StoredMeeting): boolean {
    const chosen = this.types.data.find((t) => t.key === m.kind)?.invitees === 'CHOSEN';
    return this.mayConvene(viewer, m.kind) || (!chosen && this.offices(viewer).includes('SECRETARY')) || m.chairId === viewer.id;
  }

  private managed(viewer: Member, id: string): StoredMeeting {
    const meeting = this.visible(viewer, id);
    if (!this.runs(viewer, meeting)) fail(403, 'access.denied');
    return meeting;
  }

  /** server: MeetingAccess.isQuorate */
  private quorate(m: StoredMeeting, voters: string[]): boolean {
    if (m.status !== 'INVITED' && m.status !== 'OPEN') return false;
    return isQuorate(this.type(m.kind), voters.filter((id) => m.presence[id]).length, voters.length, m.startsAt, Date.now());
  }

  private dto(viewer: Member, m: StoredMeeting): Meeting {
    const {
      presence,
      frozenElectorate: _frozen,
      protocolFinalAt: _final,
      createdBy: _by,
      createdAt: _at,
      invitees,
      guests,
      parties,
      agendaItems,
      approvals,
      chairId,
      secretaryId,
      ...rest
    } = m;
    const runs = this.runs(viewer, m);
    const voters = this.meetingVoters(m);
    const name = (id: string) => {
      const p = this.people.members.data.find((x) => x.id === id);
      return p ? `${p.firstName} ${p.lastName}` : '–';
    };
    const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
    const type = this.type(m.kind);
    return {
      ...rest,
      online: !!type.online,
      links: m.links ?? [],
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
      canManage: runs,
      // server: MeetingDto.chosen — guests' e-mail only for who runs the meeting
      chosen:
        type.invitees === 'CHOSEN'
          ? {
              members: (invitees ?? [])
                .filter((id) => !(guests ?? []).includes(id))
                .map((id) => ({ memberId: id, name: name(id) }))
                .sort(byName),
              guests: (guests ?? [])
                .map((id) => ({ id, name: name(id), email: runs ? (this.people.members.data.find((x) => x.id === id)?.email ?? null) : null }))
                .sort(byName),
              parties: (parties ?? []).map((id) => ({ memberId: id, name: name(id) })).sort(byName),
            }
          : null,
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
      audience: this.audience(m),
    });
  }
}

export const meetings = new MockMeetings(directory);

// server: MeetingsApi.OFFICE_IN_USE — a convener of a type
officeUses.push((office) => meetings.types.data.some((t) => t.conveners.includes(office) || t.steps.some((s) => s.office === office)));
const actor = (req: MockRequest) => directory.actor(req);

mockServer
  .on('GET', '/api/v1/meetings', (req) => meetings.list(actor(req), req.query.get('from'), req.query.get('to')))
  .on('GET', '/api/v1/meetings/resolution-rules', (req) => (actor(req), meetings.rules()))
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
  .on('POST', '/api/v1/meetings/:id/call', (req) => meetings.joinCall(actor(req), req.params.id))
  .on('GET', '/api/v1/meetings/:id/call', (req) => meetings.callState(actor(req), req.params.id))
  .on('DELETE', '/api/v1/meetings/:id/call', (req) => meetings.leaveCall(actor(req), req.params.id))
  .on('POST', '/api/v1/meetings/:id/call/tracks', (req) => meetings.callTracks(actor(req), req.params.id))
  .on('PUT', '/api/v1/meetings/:id/call/renegotiate', (req) => meetings.callTracks(actor(req), req.params.id))
  .on('PUT', '/api/v1/meetings/:id/presence', (req) => meetings.setPresenceMany(actor(req), req.params.id, req.body?.memberIds, req.body?.present))
  .on('PUT', '/api/v1/meetings/:id/invitees', (req) => meetings.setInvitees(actor(req), req.params.id, req.body ?? {}))
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
  .on('PUT', '/api/v1/meetings/:id/links', (req) => meetings.setLinks(actor(req), req.params.id, req.body?.refs));
