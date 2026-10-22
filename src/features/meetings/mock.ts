// Mock of the club-server meetings module (MeetingHandlers, MeetingRules).
import { directory, type MockDirectory } from '../../lib/mock/core';
import { MockServer, mockServer, type MockRequest } from '../../lib/mock/MockServer';
import { MockTable } from '../../lib/mock/MockTable';
import { resolveRef } from '../../lib/mock/recordRefs';
import { files } from '../files/mock';
import { defaultTemplate, fill, TEMPLATE_NAME } from './invitationDocument';
import type { LinkedRef, RefKind } from '../../lib/records/refs';
import { ADMIN_BOARD, type Member } from '../../lib/types';
import type { OfficeKind } from '../members/MembersApi';
import { tasks } from '../tasks/mock';
import {
  actionNeedsMember, actions, CIRCULAR_MIN_MS, IMPLIED_MAJORITY, isAssembly, latestInvite, majorities, type Choice, type FollowUp, type FollowUpKind,
  type Majority, type Meeting, type MeetingKind, type MeetingSummary, type PresenceMode, type Resolution, type ResolutionAction,
} from './model';

const fail = MockServer.fail;
const KINDS: readonly MeetingKind[] = ['ASSEMBLY', 'EXTRA_ASSEMBLY', 'BOARD', 'EXTRA_BOARD', 'SIMPLE_BOARD', 'CONSTITUENT_BOARD'];
const DAY = 86_400_000;
const GRACE = 30 * 60_000;

type StoredMeeting = Omit<Meeting, 'latestInvite' | 'electorate' | 'present' | 'quorate' | 'canManage' | 'autoTasks' | 'followUps' | 'assignable'>
  & { presence: Record<string, PresenceMode>; autoTasks?: boolean; frozenElectorate?: string[] };
/** server: meetings_follow_up */
type StoredFollowUp = { id: string; meetingId: string | null; resolutionId: string | null; kind: FollowUpKind; memberId: string | null;
  office: OfficeKind | null; title: string; dueAt: string | null; doneAt: string | null };
/** Counters hold what was voted, `ballots` only who voted (server: meetings_resolution, meetings_ballot). */
type StoredResolution = Pick<Resolution, 'id' | 'meetingId' | 'title' | 'text' | 'majority' | 'status' | 'deadline' | 'voters' | 'analogYes'
  | 'analogNo' | 'analogAbstain' | 'result' | 'openedAt' | 'closedAt'> & { yes: number; no: number; abstain: number; ballots: string[];
  action?: ResolutionAction; actionMemberId?: string | null; actionOffice?: OfficeKind | null; assigneeIds?: string[]; frozenVoters?: string[];
  links?: LinkedRef[] };

const DAY_MS = 86_400_000;
const OFFICE_NAMES: Readonly<Record<OfficeKind, string>> = { CHAIR: 'Vorsitz', VICE_CHAIR: 'Stellvertretung', TREASURER: 'Kassier:in',
  SECRETARY: 'Schriftführung', BOARD_MEMBER: 'Vorstandsmitglied', AUDITOR: 'Rechnungsprüfung' };
const AUTOMATIC: readonly FollowUpKind[] = ['ENTER_HONORARY', 'REVOKE_HONORARY', 'ENTER_OFFICE', 'CONVENE_ASSEMBLY'];

const text = (value: unknown, max: number, code: string): string | null => {
  if (value == null) return null;
  const t = String(value).trim();
  if (t.length > max) fail(400, code);
  return t || null;
};

export class MockMeetings {
  readonly meetings = new MockTable<StoredMeeting[]>('meetings', () => MockMeetings.seed());
  readonly resolutions = new MockTable<StoredResolution[]>('resolutions', () => MockMeetings.seedResolutions());
  /** meetingId → its folder and generated invitation (server: meetings_document). */
  readonly documents = new MockTable<Record<string, { folderId: string; fileId: string }>>('meeting-documents', () => ({}));

  readonly followUps = new MockTable<StoredFollowUp[]>('meeting-follow-ups', () => []);

  constructor(private readonly people: MockDirectory) {
    this.addMissingSeeds();
    // server: FollowUps.register — entering what a resolution decided finishes its task.
    mockServer.events.subscribe((event) => {
      const data = event.data as Record<string, any>;
      if (event.type === 'members.membership-changed') {
        this.complete((f) => f.kind === (data.honorary ? 'ENTER_HONORARY' : 'REVOKE_HONORARY') && f.memberId === data.memberId);
      } else if (event.type === 'members.office-assigned') {
        this.complete((f) => f.kind === 'ENTER_OFFICE' && f.memberId === data.memberId && f.office === data.office);
      }
    });
  }

  private complete(match: (f: StoredFollowUp) => boolean): void {
    for (const f of this.followUps.data.filter((x) => !x.doneAt && match(x))) {
      f.doneAt = new Date().toISOString();
      mockServer.events.publish({ type: 'meetings.follow-up-done', data: { followUpId: f.id } });
    }
    this.followUps.save();
  }

  private createFollowUp(f: StoredFollowUp, description: string | null, assigneeIds: readonly string[], createdBy: string | null): void {
    this.followUps.data.push(f);
    this.followUps.save();
    const assignees = assigneeIds.length ? [...assigneeIds] : this.people.electorate('BOARD');
    mockServer.events.publish({ type: 'meetings.follow-up-created',
      data: { followUpId: f.id, title: f.title, description, dueAt: f.dueAt, assignees, createdBy } });
  }

  private followUpDtos(list: readonly StoredFollowUp[]): FollowUp[] {
    const refs = tasks.sourced('MEETING_FOLLOW_UP', list.map((f) => f.id));
    return list.map((f) => ({ id: f.id, resolutionId: f.resolutionId, kind: f.kind, title: f.title, automatic: AUTOMATIC.includes(f.kind),
      dueAt: f.dueAt, taskId: refs[f.id]?.taskId ?? null, taskStatus: refs[f.id]?.status ?? null }));
  }

  /** server: FollowUpPlanner.plan — the tasks a passed resolution brings. */
  private planFollowUps(r: StoredResolution, meeting: StoredMeeting | null): void {
    const action = r.action ?? 'GENERAL';
    const name = r.actionMemberId ? this.name(r.actionMemberId) : '';
    const office = r.actionOffice ? OFFICE_NAMES[r.actionOffice] : '';
    const soon = new Date(Date.now() + 7 * DAY_MS).toISOString();
    const authority = new Date(Date.now() + 28 * DAY_MS).toISOString();
    const plan: [FollowUpKind, string, string | null, boolean][] = ({
      GENERAL: [['IMPLEMENT', `Beschluss umsetzen: ${r.title}`, null, false]],
      HONORARY_GRANT: [['ENTER_HONORARY', `Ehrenmitgliedschaft eintragen: ${name}`, soon, true]],
      HONORARY_REVOKE: [['REVOKE_HONORARY', `Ehrenmitgliedschaft aberkennen: ${name}`, soon, true]],
      ELECTION: [['ENTER_OFFICE', `Funktion eintragen: ${office} – ${name}`, soon, true],
        ...(r.actionOffice === 'AUDITOR' ? [] : [['REPORT_AUTHORITY', `Vereinsbehörde informieren: ${office} – ${name}`, authority, false]])],
      STATUTES_CHANGE: [['REPORT_AUTHORITY', `Statutenänderung der Vereinsbehörde anzeigen: ${r.title}`, authority, false]],
      DISSOLUTION: [['REPORT_AUTHORITY', 'Auflösung der Vereinsbehörde anzeigen (§ 14 Abs. 2)', authority, false]],
      EXCLUSION: [['NOTIFY_EXCLUSION', `Ausschluss schriftlich mit Gründen mitteilen: ${name}`, soon, true]],
      CONVENE_ASSEMBLY: [['CONVENE_ASSEMBLY', 'Außerordentliche Mitgliederversammlung einberufen', soon, false]],
    } as Record<ResolutionAction, [FollowUpKind, string, string | null, boolean][]>)[action];
    const context = `${r.text ? `${r.text}\n\n` : ''}Beschlossen ${meeting ? `in „${meeting.title}“` : 'im Umlaufverfahren'}: „${r.title}“.`;
    for (const [kind, title, dueAt, aboutMember] of plan) {
      this.createFollowUp({ id: crypto.randomUUID(), meetingId: null, resolutionId: r.id, kind, memberId: aboutMember ? r.actionMemberId ?? null : null,
        office: kind === 'ENTER_OFFICE' ? r.actionOffice ?? null : null, title: title.slice(0, 150), dueAt, doneAt: null }, context,
        r.assigneeIds?.length ? r.assigneeIds : meeting ? this.assignable(r, meeting, true) : [], null);
    }
  }

  private name(id: string): string {
    const p = this.people.members.data.find((x) => x.id === id);
    return p ? `${p.firstName} ${p.lastName}` : '–';
  }

  /** server: MeetingHandlers.setAutoTasks */
  setAutoTasks(viewer: Member, id: string, on: unknown): Meeting {
    const meeting = this.managed(viewer, id);
    meeting.autoTasks = on === true;
    this.changed(meeting, 'UPDATED');
    return this.dto(viewer, meeting);
  }

  /** server: ResolutionHandlers.createFollowUp — a task by hand for the meeting or a resolution. */
  addFollowUp(viewer: Member, target: { meetingId?: string; resolutionId?: string }, body: Record<string, any>): FollowUp {
    let meetingId: string | null = null;
    let resolutionId: string | null = null;
    let allowed: string[];
    if (target.resolutionId) {
      const r = this.managedResolution(viewer, target.resolutionId);
      resolutionId = r.id;
      allowed = this.assignable(r, r.meetingId ? this.meetings.data.find((m) => m.id === r.meetingId)! : null, false);
    } else {
      const meeting = this.managed(viewer, target.meetingId!);
      meetingId = meeting.id;
      allowed = this.assignable(null, meeting, false);
    }
    const title = text(body.title, 150, 'meeting.follow-up-title-invalid') ?? fail(400, 'meeting.follow-up-title-invalid');
    const chosen = this.checkedAssignees(body.assigneeIds, allowed);
    const managers = this.people.audienceIds({ roles: ADMIN_BOARD });
    const assignees = chosen.length ? chosen : allowed.filter((id) => managers.includes(id));
    const f: StoredFollowUp = { id: crypto.randomUUID(), meetingId, resolutionId, kind: 'MANUAL', memberId: null, office: null, title,
      dueAt: typeof body.dueAt === 'string' && body.dueAt ? body.dueAt : null, doneAt: null };
    this.createFollowUp(f, text(body.description, 2000, 'request.invalid'), assignees, viewer.id);
    return this.followUpDtos([f])[0];
  }

  /** server: MeetingHandlers.calendarMove — a circular vote keeps its start; its deadline moves later (at least three days). */
  extendDeadline(viewer: Member, id: string, start: string, end: string | null): void {
    const r = this.managedResolution(viewer, id);
    if (r.meetingId) fail(409, 'resolution.not-circular');
    if (r.status !== 'OPEN') fail(409, 'resolution.not-open');
    if (start !== r.openedAt) fail(409, 'resolution.start-fixed');
    if (!end || Date.parse(end) < Date.parse(r.openedAt!) + CIRCULAR_MIN_MS || Date.parse(end) <= Date.now()) fail(400, 'resolution.deadline-too-short');
    r.deadline = end;
    this.resolutionChanged(r, 'UPDATED');
  }

  /** server: ResolutionHandlers.setLinks */
  setResolutionLinks(viewer: Member, id: string, refs: unknown): Resolution {
    const r = this.managedResolution(viewer, id);
    if (!Array.isArray(refs) || refs.length > 30) return fail(400, 'resolution.too-many-refs');
    const kept = r.links ?? [];
    r.links = (refs as { kind: RefKind; id: string }[]).map((ref) => kept.find((k) => k.kind === ref.kind && k.id === ref.id)
      ?? resolveRef(viewer, ref, 'resolution', (other) => {
        const m = this.meetings.data.find((x) => x.id === other);
        return m && this.maySee(viewer, m) ? m.title : null;
      }));
    this.resolutionChanged(r, 'UPDATED');
    return this.resolutionDto(viewer, r);
  }

  /** server: ResolutionHandlers.setAssignees */
  setResolutionAssignees(viewer: Member, id: string, body: Record<string, any>): Resolution {
    const r = this.managedResolution(viewer, id);
    if (r.status === 'CLOSED') fail(409, 'resolution.closed');
    const meeting = r.meetingId ? this.meetings.data.find((m) => m.id === r.meetingId)! : null;
    r.assigneeIds = this.checkedAssignees(body.assigneeIds, this.assignable(r, meeting, (r.action ?? 'GENERAL') !== 'GENERAL'));
    this.resolutionChanged(r, 'UPDATED');
    return this.resolutionDto(viewer, r);
  }

  private checkedAssignees(value: unknown, allowed: readonly string[]): string[] {
    const ids = Array.isArray(value) ? [...new Set(value.map(String))] : [];
    if (ids.length > 30) fail(400, 'meeting.too-many-assignees');
    if (ids.some((id) => !this.people.members.data.some((m) => m.id === id && m.active))) fail(400, 'meeting.assignee-unknown');
    if (ids.some((id) => !allowed.includes(id))) fail(400, 'meeting.assignee-not-allowed');
    return ids;
  }

  /** Seeded meetings and votes added later reach browsers that already stored mock data. */
  private addMissingSeeds(): void {
    const meetings = MockMeetings.seed().filter((m) => !this.meetings.data.some((x) => x.id === m.id));
    const resolutions = MockMeetings.seedResolutions().filter((r) => !this.resolutions.data.some((x) => x.id === r.id));
    if (!meetings.length && !resolutions.length) return;
    this.meetings.data.push(...meetings);
    this.resolutions.data.push(...resolutions);
    this.meetings.save();
    this.resolutions.save();
  }

  /**
   * To try everything: a general meeting running now (quorate, two members without the app, one vote open), one to invite, an
   * invited board meeting, a closed board meeting with its protocol.
   */
  private static seed(): StoredMeeting[] {
    const at = (days: number, hour: number) => {
      const d = new Date(Date.now() + days * DAY);
      d.setUTCHours(hour, 0, 0, 0);
      return d.toISOString();
    };
    const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
    const base = { urgency: null, videoUrl: null, openedAt: null, closedAt: null, protocol: null, presence: {}, links: [] };
    return [
      { ...base, id: 'mt-live', kind: 'EXTRA_ASSEMBLY', title: 'Außerordentliche Mitgliederversammlung',
        agenda: '1. Begrüßung und Beschlussfähigkeit\n2. Mitgliedsbeitrag 2027\n3. Statutenänderung § 4 Abs. 3\n4. Allfälliges',
        startsAt: ago(15), endsAt: ago(-105), location: 'Vereinsheim', videoUrl: 'https://meet.example.at/mv', status: 'OPEN',
        invitedAt: ago(20 * 24 * 60), openedAt: ago(10), protocol: '1. Begrüßung durch den Vorsitz, 8 von 12 Stimmberechtigten anwesend.',
        presence: { vorstand: 'APP', kassier: 'APP', schrift: 'APP', beisitz: 'APP', beisitz2: 'APP', admin: 'APP', eltern: 'ANALOG', ehren: 'ANALOG' },
        links: [
          { kind: 'MEMBER', id: 'kassier', title: 'Karin Kassier', parentId: null },
          { kind: 'MEETING', id: 'mt-past', title: 'Ordentliche Vorstandssitzung', parentId: null },
          { kind: 'TEAM', id: 't-damen', title: 'Damen 1', parentId: null },
        ] },
      { ...base, id: 'mt-past', kind: 'BOARD', title: 'Ordentliche Vorstandssitzung', agenda: '1. Jahresvoranschlag\n2. Hallenmiete Wintersaison',
        startsAt: at(-40, 17), endsAt: at(-40, 19), location: 'Vereinsheim', status: 'CLOSED', invitedAt: at(-60, 9), openedAt: at(-40, 17),
        closedAt: at(-40, 19), protocol: '1. Jahresvoranschlag besprochen und angenommen.\n2. Hallenmiete: siehe Beschluss.',
        presence: { vorstand: 'APP', kassier: 'APP', schrift: 'APP', beisitz: 'APP', beisitz2: 'ANALOG' } },
      { ...base, id: 'mt-mv', kind: 'ASSEMBLY', title: 'Ordentliche Mitgliederversammlung', agenda: '1. Begrüßung\n2. Bericht des Vorstands\n3. Rechnungsabschluss\n4. Mitgliedsbeiträge',
        startsAt: at(30, 17), endsAt: at(30, 19), location: 'Vereinsheim', status: 'DRAFT', invitedAt: null },
      { ...base, id: 'mt-vs', kind: 'SIMPLE_BOARD', title: 'Vorstandssitzung', agenda: '1. Hallenzeiten\n2. Aufnahmeanträge',
        startsAt: at(10, 18), endsAt: at(10, 19), location: null, videoUrl: 'https://meet.example.at/vorstand', status: 'INVITED', invitedAt: new Date().toISOString() },
    ];
  }

  private static seedResolutions(): StoredResolution[] {
    const now = Date.now();
    const iso = (ms: number) => new Date(ms).toISOString();
    const base = { text: null, deadline: null, analogYes: null, analogNo: null, analogAbstain: null, result: null, openedAt: null, closedAt: null };
    return [
      { ...base, id: 'rs-beitrag', meetingId: 'mt-live', title: 'Mitgliedsbeitrag 2027: 60 €', text: 'Der Vorstand schlägt 60 € pro Jahr vor (bisher 50 €).',
        majority: 'SIMPLE', status: 'OPEN', voters: 12, openedAt: iso(now - 5 * 60_000), yes: 1, no: 1, abstain: 0, ballots: ['kassier', 'schrift'] },
      { ...base, id: 'rs-statuten', meetingId: 'mt-live', title: 'Statutenänderung § 4 Abs. 3', text: 'Ordentliche Mitglieder dürfen auch passiv teilnehmen.',
        majority: 'TWO_THIRDS', status: 'DRAFT', voters: null, yes: 0, no: 0, abstain: 0, ballots: [] },
      { ...base, id: 'rs-halle', meetingId: 'mt-past', title: 'Hallenmiete Wintersaison: 1.800 €', majority: 'SIMPLE', status: 'CLOSED', voters: 5,
        openedAt: iso(now - 40 * DAY), closedAt: iso(now - 40 * DAY + 600_000), result: 'PASSED', analogYes: 1, analogNo: 0, analogAbstain: 0,
        yes: 3, no: 0, abstain: 1, ballots: ['vorstand', 'kassier', 'schrift', 'beisitz'] },
      { ...base, id: 'rs-baelle', meetingId: null, title: 'Zehn neue Bälle um 400 €', text: 'Die alten Bälle sind abgenutzt; Angebot im Ordner Vorstand.',
        majority: 'SIMPLE', status: 'OPEN', voters: 5, deadline: iso(now + 4 * DAY), openedAt: iso(now - DAY), yes: 1, no: 0, abstain: 0, ballots: ['kassier'] },
    ];
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
    const kind = body.kind as MeetingKind;
    if (!KINDS.includes(kind)) return fail(400, 'request.invalid');
    if (!this.mayConvene(viewer, kind)) fail(403, 'meeting.may-not-convene');
    const meeting: StoredMeeting = {
      id: crypto.randomUUID(), kind, title: '', agenda: null, urgency: null, startsAt: '', endsAt: '', location: null, videoUrl: null,
      status: 'DRAFT', invitedAt: null, openedAt: null, closedAt: null, protocol: null, presence: {}, links: [],
    };
    this.apply(meeting, body);
    this.meetings.data.push(meeting);
    this.changed(meeting, 'CREATED');
    return this.dto(viewer, meeting);
  }

  update(viewer: Member, id: string, body: Record<string, any>): Meeting {
    const meeting = this.managed(viewer, id);
    if (meeting.status === 'CLOSED') fail(409, 'meeting.closed');
    const moves = (body.startsAt && body.startsAt !== meeting.startsAt) || (body.endsAt && body.endsAt !== meeting.endsAt);
    if (moves && meeting.status !== 'DRAFT') fail(409, 'meeting.invited-time-fixed');
    if (body.protocol != null && meeting.status !== 'OPEN') fail(409, 'meeting.not-open');
    this.apply(meeting, body);
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
    if (new Date().toISOString() > latestInvite(meeting.kind, meeting.startsAt)) fail(409, 'meeting.notice-too-short');
    meeting.status = 'INVITED';
    meeting.invitedAt = new Date().toISOString();
    this.changed(meeting, 'INVITED');
    if (meeting.kind === 'EXTRA_ASSEMBLY') this.complete((f) => f.kind === 'CONVENE_ASSEMBLY');
    mockServer.events.publish({
      type: 'meetings.meeting-invited',
      data: { meetingId: meeting.id, recipients: this.people.electorate(isAssembly(meeting.kind) ? 'CLUB' : 'BOARD'), kind: meeting.kind,
        title: meeting.title, agenda: meeting.agenda, startsAt: meeting.startsAt, location: meeting.location, videoUrl: meeting.videoUrl },
    });
    return this.dto(viewer, meeting);
  }

  open(viewer: Member, id: string): Meeting {
    const meeting = this.managed(viewer, id);
    if (meeting.status !== 'INVITED') fail(409, 'meeting.not-invited');
    Object.assign(meeting, { status: 'OPEN', openedAt: new Date().toISOString(), frozenElectorate: this.electorate(meeting.kind) });
    this.changed(meeting, 'OPENED');
    return this.dto(viewer, meeting);
  }

  close(viewer: Member, id: string, protocol: unknown): Meeting {
    const meeting = this.managed(viewer, id);
    if (meeting.status !== 'OPEN') fail(409, 'meeting.not-open');
    if (this.resolutions.data.some((r) => r.meetingId === id && r.status === 'OPEN')) fail(409, 'meeting.votes-open');
    const text = typeof protocol === 'string' ? protocol.trim() || null : null;
    Object.assign(meeting, { status: 'CLOSED', closedAt: new Date().toISOString(), protocol: text ?? meeting.protocol });
    this.changed(meeting, 'CLOSED');
    return this.dto(viewer, meeting);
  }

  setPresence(viewer: Member, id: string, memberId: string, mode: unknown): Meeting {
    const meeting = this.managed(viewer, id);
    if (meeting.status === 'DRAFT') fail(409, 'meeting.not-invited');
    if (meeting.status === 'CLOSED') fail(409, 'meeting.closed');
    if (!this.meetingVoters(meeting).includes(memberId)) fail(400, 'meeting.not-voter');
    if (mode === 'APP' || mode === 'ANALOG') meeting.presence[memberId] = mode;
    else delete meeting.presence[memberId];
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
      return kept.find((k) => k.kind === ref.kind && k.id === ref.id)
        ?? resolveRef(viewer, ref, 'meeting', (other) => {
          const m = this.meetings.data.find((x) => x.id === other);
          return m && this.maySee(viewer, m) ? m.title : null;
        });
    });
    this.changed(meeting, 'UPDATED');
    return this.dto(viewer, meeting);
  }

  /** server: MeetingHandlers.generateInvitation + InvitationDocuments — the template in "Vorlagen" filled through the files mock. */
  async generateInvitation(viewer: Member, id: string): Promise<Meeting> {
    const meeting = this.managed(viewer, id);
    const { default: JSZip } = await import('jszip');
    const request = (params: Record<string, string>, form: FormData) => ({ params, query: new URLSearchParams(), body: form, email: viewer.email });
    const top = (name: string, scope: 'CLUB' | 'BOARD') => files.listFolders(viewer).find((f) => !f.parentId && f.name === name && f.scope === scope)
      ?? files.createFolder(viewer, { name, kind: 'DOCUMENTS', scope, teamIds: [] });

    const templates = top('Vorlagen', 'BOARD');
    let template = files.listFiles(viewer, templates.id).find((f) => f.name.toLowerCase() === TEMPLATE_NAME.toLowerCase());
    if (!template) {
      const form = new FormData();
      form.append('file', new File([await defaultTemplate(JSZip)], TEMPLATE_NAME));
      template = await files.upload(request({ folderId: templates.id }, form));
    }
    // Mock blobs live only for the session; after a reload the built-in template stands in.
    const templateBytes = files.blob(template.id) ?? (await defaultTemplate(JSZip));
    const KIND = { ASSEMBLY: 'ordentlichen Mitgliederversammlung', EXTRA_ASSEMBLY: 'außerordentlichen Mitgliederversammlung',
      BOARD: 'ordentlichen Vorstandssitzung', EXTRA_BOARD: 'außerordentlichen Vorstandssitzung', SIMPLE_BOARD: 'einfachen Vorstandssitzung',
      CONSTITUENT_BOARD: 'konstituierenden Vorstandssitzung' } as const;
    const STATUTE = { ASSEMBLY: '§ 8 Abs. 4', EXTRA_ASSEMBLY: '§ 8 Abs. 4', BOARD: '§ 10 Abs. 6', CONSTITUENT_BOARD: '§ 10 Abs. 6',
      SIMPLE_BOARD: '§ 10 Abs. 7', EXTRA_BOARD: '§ 10 Abs. 3' } as const;
    const kindTitle = KIND[meeting.kind].replace('en ', 'e ');
    const fmt = (iso: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('de-AT', { timeZone: this.people.club.timeZone, ...options }).format(new Date(iso));
    const content = await fill(JSZip, templateBytes, {
      Verein: this.people.club.name, Art: KIND[meeting.kind],
      Titel: meeting.title.toLowerCase() === kindTitle.toLowerCase() ? null : meeting.title,
      Wann: `${fmt(meeting.startsAt, { dateStyle: 'full', timeStyle: 'short' })} bis ${fmt(meeting.endsAt, { timeStyle: 'short' })} Uhr`,
      Ort: meeting.location, Video: meeting.videoUrl, Dringlichkeit: meeting.urgency, Statuten: STATUTE[meeting.kind],
      Versandt: fmt(meeting.invitedAt ?? new Date().toISOString(), { dateStyle: 'long' }),
    }, (meeting.agenda ?? '').split('\n').map((l) => l.trim()).filter(Boolean).concat(meeting.agenda?.trim() ? [] : ['Keine Tagesordnung eingetragen.']));

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
      const assembly = isAssembly(meeting.kind);
      const parent = top(assembly ? 'Mitgliederversammlungen' : 'Vorstandssitzungen', assembly ? 'CLUB' : 'BOARD');
      folderId = stored && files.listFolders(viewer).some((f) => f.id === stored.folderId) ? stored.folderId
        : files.createFolder(viewer, { parentId: parent.id, name: `${day} ${meeting.title}`.slice(0, 100), kind: 'DOCUMENTS' }).id;
      const form = new FormData();
      form.append('file', new File([content], `Einladung ${day} ${meeting.title}.docx`));
      fileId = (await files.upload(request({ folderId }, form))).id;
    }
    this.documents.data[id] = { folderId, fileId };
    this.documents.save();
    const name = files.files.data.find((f) => f.id === fileId)!.name;
    meeting.links = [{ kind: 'FILE' as const, id: fileId, title: name, parentId: folderId }, ...(meeting.links ?? []).filter((l) => l.id !== fileId)].slice(0, 30);
    this.changed(meeting, 'UPDATED');
    return this.dto(viewer, meeting);
  }

  // --- resolutions (server: ResolutionHandlers) ---

  listResolutions(viewer: Member, meetingId: string | null): { items: Resolution[] } {
    if (meetingId === null) {
      if (!this.people.hasRole(viewer, ADMIN_BOARD)) fail(403, 'access.denied');
      return { items: this.resolutions.data.filter((r) => r.meetingId === null).reverse().map((r) => this.resolutionDto(viewer, r)) };
    }
    this.visible(viewer, meetingId);
    return { items: this.resolutions.data.filter((r) => r.meetingId === meetingId).map((r) => this.resolutionDto(viewer, r)) };
  }

  getResolution(viewer: Member, id: string): Resolution {
    return this.resolutionDto(viewer, this.resolution(viewer, id));
  }

  createResolution(viewer: Member, meetingId: string | null, body: Record<string, any>): Resolution {
    this.people.requirePrivileged(viewer, ADMIN_BOARD);
    const meeting = meetingId ? this.managed(viewer, meetingId) : null;
    if (!meeting && !this.runsCircular(viewer)) fail(403, 'access.denied');
    if (meeting?.status === 'CLOSED') fail(409, 'meeting.closed');
    // server: FollowUpPlanner.check
    const action = (body.action ?? 'GENERAL') as ResolutionAction;
    if (!actions(meeting?.kind ?? null).includes(action)) fail(400, 'resolution.action-not-here');
    if (actionNeedsMember(action) !== !!body.actionMemberId) fail(400, 'resolution.action-member-missing');
    if ((action === 'ELECTION') !== !!body.actionOffice) fail(400, 'resolution.action-office-missing');
    const requested = (meeting ? body.majority ?? null : 'SIMPLE') as Majority | null;
    const implied = IMPLIED_MAJORITY[action] ?? requested;
    if (requested && implied !== requested) fail(400, 'resolution.majority-mismatch');
    const majority = implied && majorities(meeting?.kind ?? null).includes(implied) ? implied : fail(400, 'resolution.majority-invalid');
    const assigneeIds = this.checkedAssignees(body.assigneeIds, this.assignable(null, meeting, action !== 'GENERAL'));
    const title = text(body.title, 200, 'resolution.title-invalid') ?? fail(400, 'resolution.title-invalid');
    const deadline = meeting ? null : typeof body.deadline === 'string' ? new Date(body.deadline).toISOString() : fail(400, 'resolution.deadline-invalid');
    const r: StoredResolution = {
      id: crypto.randomUUID(), meetingId, title, text: text(body.text, 4000, 'resolution.text-too-long'), majority, status: 'DRAFT', deadline,
      voters: null, analogYes: null, analogNo: null, analogAbstain: null, result: null, openedAt: null, closedAt: null, yes: 0, no: 0, abstain: 0, ballots: [],
      action, actionMemberId: body.actionMemberId ?? null, actionOffice: body.actionOffice ?? null, assigneeIds,
    };
    this.resolutions.data.push(r);
    this.resolutionChanged(r, 'CREATED');
    return this.resolutionDto(viewer, r);
  }

  deleteResolution(viewer: Member, id: string): void {
    const r = this.managedResolution(viewer, id);
    if (r.status !== 'DRAFT') fail(409, 'resolution.not-draft');
    this.resolutions.data.splice(this.resolutions.data.indexOf(r), 1);
    this.resolutionChanged(r, 'DELETED');
  }

  openResolution(viewer: Member, id: string): Resolution {
    const r = this.managedResolution(viewer, id);
    if (r.status !== 'DRAFT') fail(409, 'resolution.not-draft');
    const meeting = r.meetingId ? this.meetings.data.find((m) => m.id === r.meetingId)! : null;
    if (meeting && meeting.status !== 'OPEN') fail(409, 'meeting.not-open');
    if (meeting && !this.quorate(meeting, this.meetingVoters(meeting))) fail(409, 'resolution.not-quorate');
    if (!meeting && Date.parse(r.deadline!) < Date.now() + CIRCULAR_MIN_MS) fail(400, 'resolution.deadline-too-short');
    const voters = this.voters(r);
    Object.assign(r, { status: 'OPEN', openedAt: new Date().toISOString(), voters: voters.length, frozenVoters: meeting ? undefined : voters });
    this.resolutionChanged(r, 'OPENED');
    if (!meeting) {
      mockServer.events.publish({ type: 'meetings.circular-opened', data: { resolutionId: r.id, recipients: voters, title: r.title, text: r.text, deadline: r.deadline } });
    }
    return this.resolutionDto(viewer, r);
  }

  closeResolution(viewer: Member, id: string): Resolution {
    return this.resolutionDto(viewer, this.closeNow(this.managedResolution(viewer, id)));
  }

  vote(viewer: Member, id: string, choice: Choice): Resolution {
    const r = this.resolution(viewer, id);
    if (!this.voters(r).includes(viewer.id)) fail(403, 'resolution.not-voter');
    if (r.meetingId) {
      const mode = this.meetings.data.find((m) => m.id === r.meetingId)!.presence[viewer.id];
      if (!mode) fail(409, 'resolution.not-present');
      if (mode === 'ANALOG') fail(409, 'resolution.vote-analog');
    }
    return this.resolutionDto(viewer, this.cast(r, viewer.id, choice));
  }

  recordVote(viewer: Member, id: string, memberId: string, choice: Choice): Resolution {
    const r = this.managedResolution(viewer, id);
    if (r.meetingId) fail(409, 'resolution.not-circular');
    if (!this.voters(r).includes(memberId)) fail(400, 'resolution.not-voter');
    return this.resolutionDto(viewer, this.cast(r, memberId, choice));
  }

  analogVotes(viewer: Member, id: string, body: Record<string, any>): Resolution {
    const r = this.managedResolution(viewer, id);
    if (!r.meetingId) fail(409, 'resolution.circular');
    if (r.status !== 'OPEN') fail(409, 'resolution.not-open');
    if (r.analogYes !== null) fail(409, 'resolution.analog-already-entered');
    const [yes, no, abstain] = [body.yes, body.no, body.abstain].map((v) => (Number.isInteger(v) && v >= 0 ? (v as number) : fail(400, 'resolution.analog-invalid')));
    if (yes + no + abstain > this.analogPresent(r)) fail(409, 'resolution.analog-exceeds-present');
    Object.assign(r, { analogYes: yes, analogNo: no, analogAbstain: abstain });
    this.resolutionChanged(r, 'VOTED');
    return this.resolutionDto(viewer, r);
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
    const passes = valid > 0 && (r.majority === 'SIMPLE' ? yes * 2 > valid : r.majority === 'TWO_THIRDS' ? yes * 3 >= valid * 2 : yes * 4 >= valid * 3);
    const result = !r.meetingId && r.ballots.length * 2 <= (r.voters ?? 0) ? 'NOT_QUORATE' : passes ? 'PASSED' : 'FAILED';
    Object.assign(r, { status: 'CLOSED', closedAt: new Date().toISOString(), result });
    const meeting = r.meetingId ? this.meetings.data.find((m) => m.id === r.meetingId)! : null;
    if (result === 'PASSED' && (!meeting || meeting.autoTasks !== false)) this.planFollowUps(r, meeting);
    this.resolutionChanged(r, 'CLOSED');
    return r;
  }

  private voters(r: StoredResolution): string[] {
    if (r.meetingId) return this.meetingVoters(this.meetings.data.find((m) => m.id === r.meetingId)!);
    return r.status !== 'DRAFT' && r.frozenVoters?.length ? r.frozenVoters : this.people.electorate('BOARD');
  }

  private analogPresent(r: StoredResolution): number {
    const meeting = r.meetingId ? this.meetings.data.find((m) => m.id === r.meetingId) : null;
    if (!meeting) return 0;
    const voters = this.meetingVoters(meeting);
    return Object.entries(meeting.presence).filter(([id, mode]) => mode === 'ANALOG' && voters.includes(id)).length;
  }

  private runsCircular(viewer: Member): boolean {
    return this.mayConvene(viewer, 'SIMPLE_BOARD') || this.offices(viewer).includes('SECRETARY');
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
    const { yes, no, abstain, ballots, action: _a, actionMemberId: _m, actionOffice: _o, assigneeIds: _as, frozenVoters: _f, links: _l, ...rest } = r;
    const closed = r.status === 'CLOSED';
    const voters = this.voters(r);
    const manages = this.managesResolution(viewer, r);
    const mode = r.meetingId ? this.meetings.data.find((m) => m.id === r.meetingId)!.presence[viewer.id] : 'APP';
    const name = (id: string) => {
      const p = this.people.members.data.find((x) => x.id === id);
      return p ? `${p.firstName} ${p.lastName}` : '–';
    };
    return {
      ...rest,
      yes: closed ? yes : null, no: closed ? no : null, abstain: closed ? abstain : null,
      analogYes: closed ? r.analogYes : null, analogNo: closed ? r.analogNo : null, analogAbstain: closed ? r.analogAbstain : null,
      analogEntered: r.analogYes !== null, analogPresent: this.analogPresent(r), ballots: ballots.length,
      voted: ballots.includes(viewer.id),
      canVote: r.status === 'OPEN' && !ballots.includes(viewer.id) && voters.includes(viewer.id) && mode === 'APP',
      canManage: manages,
      pending: !r.meetingId && r.status === 'OPEN' && manages ? voters.filter((id) => !ballots.includes(id)).map((id) => ({ memberId: id, name: name(id) })) : [],
      action: r.action ?? 'GENERAL',
      actionMember: r.actionMemberId ? { memberId: r.actionMemberId, name: name(r.actionMemberId) } : null,
      actionOffice: r.actionOffice ?? null,
      assignees: (r.assigneeIds ?? []).map((id) => ({ memberId: id, name: name(id) })),
      followUps: this.followUpDtos(this.followUps.data.filter((f) => f.resolutionId === r.id)),
      assignable: manages
        ? this.assignable(r, r.meetingId ? this.meetings.data.find((m) => m.id === r.meetingId)! : null, r.status !== 'CLOSED' && (r.action ?? 'GENERAL') !== 'GENERAL')
          .map((id) => ({ memberId: id, name: name(id) })).sort((a, b) => a.name.localeCompare(b.name))
        : [],
      links: r.links ?? [],
    };
  }

  private resolutionChanged(r: StoredResolution, change: string): void {
    this.resolutions.save();
    const meeting = r.meetingId ? this.meetings.data.find((m) => m.id === r.meetingId) : null;
    mockServer.events.publish({ type: 'meetings.resolution-changed', data: { resolutionId: r.id, meetingId: r.meetingId, change },
      audience: meeting && isAssembly(meeting.kind) ? { everyone: true } : { roles: ADMIN_BOARD } });
  }

  /** server: Meeting record validation */
  private apply(m: StoredMeeting, body: Record<string, any>): void {
    if (body.title !== undefined) m.title = text(body.title, 120, 'meeting.title-invalid') ?? fail(400, 'meeting.title-invalid');
    if (body.agenda !== undefined) m.agenda = text(body.agenda, 4000, 'meeting.agenda-too-long');
    if (body.urgency !== undefined) m.urgency = text(body.urgency, 1000, 'meeting.urgency-invalid');
    if (body.location !== undefined) m.location = text(body.location, 200, 'meeting.location-too-long');
    if (body.videoUrl !== undefined) m.videoUrl = text(body.videoUrl, 500, 'meeting.video-url-invalid');
    if (body.protocol !== undefined) m.protocol = text(body.protocol, 20000, 'meeting.protocol-too-long');
    if (body.startsAt) m.startsAt = new Date(body.startsAt).toISOString();
    if (body.endsAt) m.endsAt = new Date(body.endsAt).toISOString();
    if (!m.startsAt || !m.endsAt || m.endsAt <= m.startsAt) fail(400, 'meeting.times-invalid');
    if (Date.parse(m.endsAt) - Date.parse(m.startsAt) > DAY) fail(400, 'meeting.too-long');
    if (m.videoUrl && !m.videoUrl.startsWith('https://')) fail(400, 'meeting.video-url-invalid');
    if ((m.kind === 'EXTRA_BOARD') !== !!m.urgency) fail(400, 'meeting.urgency-invalid');
    this.meetings.save();
  }

  private electorate(kind: MeetingKind): string[] {
    return this.people.electorate(isAssembly(kind) ? 'ASSEMBLY' : 'BOARD');
  }

  /** server: MeetingAccess.electorate — fixed when the meeting opened. */
  private meetingVoters(m: StoredMeeting): string[] {
    return (m.status === 'OPEN' || m.status === 'CLOSED') && m.frozenElectorate?.length ? m.frozenElectorate : this.electorate(m.kind);
  }

  /** server: ResolutionHandlers.assignable — those present (the board for circular votes); admins and board members if needed. */
  private assignable(r: StoredResolution | null, meeting: StoredMeeting | null, managersOnly: boolean): string[] {
    const voters = meeting ? this.meetingVoters(meeting) : r ? this.voters(r) : this.people.electorate('BOARD');
    const base = meeting ? Object.keys(meeting.presence).filter((id) => voters.includes(id)) : voters;
    if (!managersOnly) return base;
    return base.filter((id) => this.people.members.data.some((m) => m.id === id && m.active && this.people.hasRole(m, ADMIN_BOARD)));
  }

  private offices(viewer: Member): OfficeKind[] {
    return this.people.officesOf(viewer.id);
  }

  /** server: MeetingRules.mayConvene */
  private mayConvene(viewer: Member, kind: MeetingKind): boolean {
    if (viewer.roles.includes('ADMIN')) return true;
    const offices = this.offices(viewer);
    const board = offices.some((o) => o !== 'AUDITOR');
    const chair = offices.includes('CHAIR') || offices.includes('VICE_CHAIR');
    return isAssembly(kind) || kind === 'SIMPLE_BOARD' ? board : chair;
  }

  private maySee(viewer: Member, m: StoredMeeting): boolean {
    if (this.people.hasRole(viewer, ADMIN_BOARD)) return true;
    return isAssembly(m.kind) && (!!viewer.membershipType || viewer.honorary);
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

  /** server: MeetingRules.isQuorate */
  private quorate(m: StoredMeeting, voters: string[]): boolean {
    const present = voters.filter((id) => m.presence[id]).length;
    if (!voters.length || !present || (m.status !== 'INVITED' && m.status !== 'OPEN')) return false;
    if (isAssembly(m.kind)) return present * 2 >= voters.length || Date.now() >= Date.parse(m.startsAt) + GRACE;
    if (m.kind === 'EXTRA_BOARD') return present * 4 >= voters.length * 3;
    return present * 2 > voters.length;
  }

  private dto(viewer: Member, m: StoredMeeting): Meeting {
    const { presence, frozenElectorate: _frozen, ...rest } = m;
    const voters = this.meetingVoters(m);
    const name = (id: string) => {
      const p = this.people.members.data.find((x) => x.id === id);
      return p ? `${p.firstName} ${p.lastName}` : '–';
    };
    const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
    return {
      ...rest,
      links: m.links ?? [], // mock data stored before links existed
      autoTasks: m.autoTasks !== false,
      followUps: this.followUpDtos(this.followUps.data.filter((f) => f.meetingId === m.id && !f.resolutionId)),
      latestInvite: latestInvite(m.kind, m.startsAt),
      electorate: voters.map((id) => ({ memberId: id, name: name(id) })).sort(byName),
      present: Object.entries(presence).map(([id, mode]) => ({ memberId: id, name: name(id), mode })).sort(byName),
      quorate: this.quorate(m, voters),
      canManage: this.mayConvene(viewer, m.kind) || this.offices(viewer).includes('SECRETARY'),
      assignable: this.mayConvene(viewer, m.kind) || this.offices(viewer).includes('SECRETARY')
        ? this.assignable(null, m, false).map((id) => ({ memberId: id, name: name(id), manager: this.assignable(null, m, true).includes(id) })).sort(byName)
        : [],
    };
  }

  private changed(m: StoredMeeting, change: string): void {
    this.meetings.save();
    mockServer.events.publish({ type: 'meetings.meeting-changed', data: { meetingId: m.id, change },
      audience: isAssembly(m.kind) ? { everyone: true } : { roles: ADMIN_BOARD } });
  }
}

export const meetings = new MockMeetings(directory);
const actor = (req: MockRequest) => directory.actor(req);

mockServer
  .on('GET', '/api/v1/meetings', (req) => meetings.list(actor(req), req.query.get('from'), req.query.get('to')))
  .on('POST', '/api/v1/meetings', (req) => meetings.create(actor(req), req.body ?? {}))
  .on('GET', '/api/v1/meetings/:id', (req) => meetings.get(actor(req), req.params.id))
  .on('PATCH', '/api/v1/meetings/:id', (req) => meetings.update(actor(req), req.params.id, req.body ?? {}))
  .on('DELETE', '/api/v1/meetings/:id', (req) => meetings.delete(actor(req), req.params.id))
  .on('POST', '/api/v1/meetings/:id/invite', (req) => meetings.invite(actor(req), req.params.id))
  .on('POST', '/api/v1/meetings/:id/open', (req) => meetings.open(actor(req), req.params.id))
  .on('POST', '/api/v1/meetings/:id/close', (req) => meetings.close(actor(req), req.params.id, req.body?.protocol))
  .on('GET', '/api/v1/meetings/:id/resolutions', (req) => meetings.listResolutions(actor(req), req.params.id))
  .on('POST', '/api/v1/meetings/:id/resolutions', (req) => meetings.createResolution(actor(req), req.params.id, req.body ?? {}))
  .on('GET', '/api/v1/resolutions', (req) => meetings.listResolutions(actor(req), null))
  .on('POST', '/api/v1/resolutions', (req) => meetings.createResolution(actor(req), null, req.body ?? {}))
  .on('GET', '/api/v1/resolutions/:id', (req) => meetings.getResolution(actor(req), req.params.id))
  .on('DELETE', '/api/v1/resolutions/:id', (req) => meetings.deleteResolution(actor(req), req.params.id))
  .on('POST', '/api/v1/resolutions/:id/open', (req) => meetings.openResolution(actor(req), req.params.id))
  .on('POST', '/api/v1/resolutions/:id/close', (req) => meetings.closeResolution(actor(req), req.params.id))
  .on('POST', '/api/v1/resolutions/:id/vote', (req) => meetings.vote(actor(req), req.params.id, req.body?.choice))
  .on('POST', '/api/v1/resolutions/:id/recorded-vote', (req) => meetings.recordVote(actor(req), req.params.id, req.body?.memberId, req.body?.choice))
  .on('POST', '/api/v1/resolutions/:id/analog-votes', (req) => meetings.analogVotes(actor(req), req.params.id, req.body ?? {}))
  .on('POST', '/api/v1/meetings/:id/invitation-document', (req) => meetings.generateInvitation(actor(req), req.params.id))
  .on('PUT', '/api/v1/meetings/:id/auto-tasks', (req) => meetings.setAutoTasks(actor(req), req.params.id, req.body?.on))
  .on('POST', '/api/v1/meetings/:id/follow-ups', (req) => meetings.addFollowUp(actor(req), { meetingId: req.params.id }, req.body ?? {}))
  .on('POST', '/api/v1/resolutions/:id/follow-ups', (req) => meetings.addFollowUp(actor(req), { resolutionId: req.params.id }, req.body ?? {}))
  .on('PUT', '/api/v1/resolutions/:id/links', (req) => meetings.setResolutionLinks(actor(req), req.params.id, req.body?.refs))
  .on('PUT', '/api/v1/resolutions/:id/assignees', (req) => meetings.setResolutionAssignees(actor(req), req.params.id, req.body ?? {}))
  .on('PUT', '/api/v1/meetings/:id/links', (req) => meetings.setLinks(actor(req), req.params.id, req.body?.refs))
  .on('PUT', '/api/v1/meetings/:id/presence/:memberId', (req) => meetings.setPresence(actor(req), req.params.id, req.params.memberId, req.body?.mode));
