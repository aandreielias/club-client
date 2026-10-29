// Mock of the club-server meetings module (MeetingHandlers, MeetingTypeHandlers, MeetingType).
import { generatedKey } from '../../lib/mock/keys';
import { directory, MockDirectory } from '../../lib/mock/core';
import { MockServer, mockServer, type MockRequest } from '../../lib/mock/MockServer';
import { MockTable } from '../../lib/mock/MockTable';
import { resolveRef } from '../../lib/mock/recordRefs';
import { appointmentTypes } from '../calendar/mock';
import { files } from '../files/mock';
import { defaultTemplate, fill, TEMPLATE_NAME } from './invitationDocument';
import type { RefKind } from '../../lib/records/refs';
import { ADMIN_BOARD, type Member } from '../../lib/types';
import type { OfficeKind } from '../members/MembersApi';
import { tasks } from '../tasks/mock';
import {
  ALL_MAJORITIES,
  BOARD_OFFICES,
  defaultSteps,
  seedMeetings,
  seededRules,
  seedResolutions,
  SEEDED_TYPES,
  type StoredFollowUp,
  type StoredMeeting,
  type StoredResolution,
  type StoredType,
} from './mockSeeds';
import {
  actionNeedsMember,
  actions,
  isOwnAction,
  isAssembly,
  quorumReached,
  NO_STATUTES,
  SEEDED_CIRCULAR,
  type CircularRules,
  type ResolutionRules,
  type StatutesPlace,
  AUTOMATIC_FOLLOW_UPS,
  NAMES_MEMBER,
  OWN_ACTION,
  TARGETED_FOLLOW_UPS,
  plainFollowUp,
  type FollowUpAssignee,
  type FollowUpRule,
  type ActionRule,
  isDayOfYear,
  isQuorate,
  latestInvite,
  majorities,
  mayConvene,
  type Choice,
  type FollowUp,
  type FollowUpKind,
  type Majority,
  type Meeting,
  type MeetingKind,
  type MeetingSummary,
  type MeetingType,
  type MeetingStep,
  type Quorum,
  type Resolution,
  type ResolutionAction,
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

const FOLLOW_UP_KINDS = [
  'IMPLEMENT',
  'ENTER_HONORARY',
  'REVOKE_HONORARY',
  'ENTER_OFFICE',
  'NOTIFY_EXCLUSION',
  'CONVENE_ASSEMBLY',
  'UPLOAD_STATUTES',
  'UPLOAD_FILE',
  'INVITE_MEETING',
  'CREATE_APPOINTMENT',
] as const;
const ABOUT_MEMBER: readonly FollowUpKind[] = ['ENTER_HONORARY', 'REVOKE_HONORARY', 'ENTER_OFFICE', 'NOTIFY_EXCLUSION'];

const QUORUMS: readonly Quorum[] = ['AT_LEAST_HALF', 'MORE_THAN_HALF', 'AT_LEAST_THREE_QUARTERS'];
const OFFICES: readonly OfficeKind[] = [...BOARD_OFFICES, 'AUDITOR'];
const ACTIONS: readonly ResolutionAction[] = [
  'GENERAL',
  'HONORARY_GRANT',
  'HONORARY_REVOKE',
  'ELECTION',
  'STATUTES_CHANGE',
  'DISSOLUTION',
  'EXCLUSION',
  'CONVENE_ASSEMBLY',
];

const DAY_MS = 86_400_000;

/** server: FollowUpPlanner.hint for the targeted kinds */
const targetHint = (kind: FollowUpKind, name: string): string =>
  kind === 'UPLOAD_FILE'
    ? `Erledigt sich von selbst, sobald eine Datei im Ordner „${name}“ gespeichert ist.`
    : kind === 'INVITE_MEETING'
      ? `Erledigt sich von selbst, sobald zu einer Sitzung „${name}“ eingeladen ist.`
      : `Erledigt sich von selbst, sobald ein Termin „${name}“ angelegt ist.`;
const ASSIGNEES: readonly FollowUpAssignee[] = ['DEFAULT', 'BOARD', 'OFFICE', 'MANAGER', 'MEMBER'];

/** server: FollowUp.checklist — trimmed, empty ones dropped, at most 20 of 200 characters. */
const cleanChecklist = (items: unknown, code: string): string[] => {
  const out = (Array.isArray(items) ? items : []).map((t) => String(t ?? '').trim()).filter(Boolean);
  if (out.length > 20 || out.some((t) => t.length > 200)) fail(400, code);
  return out;
};
const AUTOMATIC = AUTOMATIC_FOLLOW_UPS;

const text = (value: unknown, max: number, code: string): string | null => {
  if (value == null) return null;
  const t = String(value).trim();
  if (t.length > max) fail(400, code);
  return t || null;
};

export class MockMeetings {
  readonly rules = new MockTable<ActionRule[]>('resolution-rules', seededRules);
  /** server: meetings_setting */
  readonly circular = new MockTable<CircularRules>('circular-rules', () => ({ ...SEEDED_CIRCULAR }));
  /** server: meetings_setting.statutes_* */
  readonly statutes = new MockTable<StatutesPlace>('statutes-place', () => ({ ...NO_STATUTES }));
  readonly types = new MockTable<StoredType[]>('meeting-types', () => structuredClone([...SEEDED_TYPES]));
  readonly meetings = new MockTable<StoredMeeting[]>('meetings', () => seedMeetings());
  readonly resolutions = new MockTable<StoredResolution[]>('resolutions', () => seedResolutions());
  /** meetingId → its folder and generated invitation (server: meetings_document). */
  readonly documents = new MockTable<Record<string, { folderId: string; fileId: string }>>('meeting-documents', () => ({}));

  readonly followUps = new MockTable<StoredFollowUp[]>('meeting-follow-ups', () => []);

  constructor(private readonly people: MockDirectory) {
    this.addMissingSeeds();
    // server: the hourly reminder run gives every draft and open circular vote its deadline task
    for (const m of this.meetings.data.filter((x) => x.status === 'DRAFT')) this.inviteTask(m);
    for (const r of this.resolutions.data.filter((x) => !x.meetingId && x.status === 'OPEN')) this.circularTask(r, 'vorstand');
    // server: FollowUps.register — entering what a resolution decided finishes its task.
    mockServer.events.subscribe((event) => {
      const data = event.data as Record<string, any>;
      if (event.type === 'members.membership-changed') {
        this.complete((f) => f.kind === (data.honorary ? 'ENTER_HONORARY' : 'REVOKE_HONORARY') && f.memberId === data.memberId);
      } else if (event.type === 'members.office-assigned') {
        this.complete((f) => f.kind === 'ENTER_OFFICE' && f.memberId === data.memberId && f.office === data.office);
      } else if (event.type === 'tasks.sourced-done' && data.source?.kind === 'MEETING_FOLLOW_UP') {
        // server: FollowUps.register — its task done: the follow-up is done, those waiting for it start
        const f = this.followUps.data.find((x) => x.id === data.source.id);
        if (f && !f.doneAt) f.doneAt = new Date().toISOString();
        this.release(data.source.id);
      } else if (event.type === 'files.file-stored') {
        const s = this.statutes.data;
        if (s.fileId ? data.newVersion && s.fileId === data.fileId : s.folderId != null && s.folderId === data.folderId) {
          this.complete((f) => f.kind === 'UPLOAD_STATUTES');
        }
        this.complete((f) => f.kind === 'UPLOAD_FILE' && f.target === data.folderId && !f.pending);
      } else if (event.type === 'calendar.appointment-created') {
        this.complete((f) => f.kind === 'CREATE_APPOINTMENT' && f.target === data.type && !f.pending);
      } else if (event.type === 'members.member-erased') {
        // server: MeetingRepository.renameMemberLinks
        for (const record of [...this.meetings.data, ...this.resolutions.data]) {
          for (const link of record.links ?? []) if (link.kind === 'MEMBER' && link.id === data.memberId) link.title = MockDirectory.ERASED_NAME;
        }
        this.meetings.save();
        this.resolutions.save();
      }
    });
  }

  private complete(match: (f: StoredFollowUp) => boolean): void {
    for (const f of this.followUps.data.filter((x) => !x.doneAt && match(x))) {
      f.doneAt = new Date().toISOString();
      mockServer.events.publish({ type: 'meetings.follow-up-done', data: { followUpId: f.id } });
      this.release(f.id);
    }
    this.followUps.save();
  }

  /** server: FollowUps.create — one that waits keeps its task data until the one before is done. */
  private createFollowUp(
    f: StoredFollowUp,
    description: string | null,
    assigneeIds: readonly string[],
    createdBy: string | null,
    checklist: readonly string[] = [],
    dueDays: number | null = null,
  ): void {
    const assignees = assigneeIds.length ? [...assigneeIds] : this.people.electorate('BOARD');
    if (f.waitsFor) f.pending = { description, checklist: [...checklist], assignees, createdBy, dueDays };
    this.followUps.data.push(f);
    this.followUps.save();
    if (f.waitsFor) return;
    mockServer.events.publish({
      type: 'meetings.follow-up-created',
      data: { followUpId: f.id, title: f.title, description, dueAt: f.dueAt, assignees, createdBy, checklist: [...checklist] },
    });
  }

  /** server: FollowUps.release — those waiting for `doneId` get their task, due from now. */
  private release(doneId: string): void {
    for (const f of this.followUps.data.filter((x) => x.waitsFor === doneId && x.pending)) {
      const p = f.pending!;
      f.pending = null;
      f.dueAt = p.dueDays == null ? null : new Date(Date.now() + p.dueDays * DAY_MS).toISOString();
      mockServer.events.publish({
        type: 'meetings.follow-up-created',
        data: {
          followUpId: f.id,
          title: f.title,
          description: p.description,
          dueAt: f.dueAt,
          assignees: p.assignees,
          createdBy: p.createdBy,
          checklist: p.checklist,
        },
      });
    }
    this.followUps.save();
  }

  private followUpDtos(list: readonly StoredFollowUp[]): FollowUp[] {
    const refs = tasks.sourced(
      'MEETING_FOLLOW_UP',
      list.map((f) => f.id),
    );
    return list.map((f) => ({
      id: f.id,
      resolutionId: f.resolutionId,
      kind: f.kind,
      title: f.title,
      automatic: AUTOMATIC.includes(f.kind),
      dueAt: f.dueAt,
      taskId: refs[f.id]?.taskId ?? null,
      taskStatus: refs[f.id]?.status ?? null,
      waitsFor: f.waitsFor ?? null,
      waiting: !refs[f.id] && !!f.waitsFor && !f.doneAt,
    }));
  }

  /** server: FollowUpPlanner.plan — the tasks a passed resolution brings, from the club's rules. */
  private planFollowUps(r: StoredResolution, meeting: StoredMeeting | null): void {
    const action = r.action ?? 'GENERAL';
    const name = r.actionMemberId ? this.name(r.actionMemberId) : '';
    const office = r.actionOffice ? this.people.boardSettings.data.offices.find((o) => o.office === r.actionOffice)!.label : '';
    const context = `${r.text ? `${r.text}\n\n` : ''}Beschlossen ${meeting ? `in „${meeting.title}“` : 'im Umlaufverfahren'}: „${r.title}“.`;
    const s = this.statutes.data;
    // server: FollowUpPlanner.hint
    const statutesHint = s.fileId
      ? `Die neue Fassung als neue Version von „${s.fileName}“ in Dateien hochladen; die Aufgabe erledigt sich dann von selbst.`
      : s.folderId
        ? `Die neue Fassung in den Ordner „${s.folderName}“ in Dateien hochladen; die Aufgabe erledigt sich dann von selbst.`
        : 'Die neue Fassung in Dateien hochladen und die Aufgabe erledigen. Unter Einstellungen › Beschlüsse lässt sich festlegen, wo die Statuten liegen; dann erledigt sie sich von selbst.';
    const chosen = r.assigneeIds?.length ? r.assigneeIds : meeting ? this.assignable(r, meeting, true) : [];
    const fill = (t: string) => t.replaceAll('{beschluss}', r.title).replaceAll('{mitglied}', name).replaceAll('{funktion}', office);
    let previous: string | null = null;
    for (const stored of [...this.rules.data.find((x) => x.action === action)!.followUps, ...(r.ownFollowUps ?? [])]) {
      const rule = { ...plainFollowUp(stored.kind, stored.title, stored.dueDays), ...stored };
      const about = ABOUT_MEMBER.includes(rule.kind);
      const waitsFor = rule.afterPrevious ? previous : null;
      const id = crypto.randomUUID();
      const description = rule.description ? `${fill(rule.description).slice(0, 2000)}\n\n${context}` : context;
      this.createFollowUp(
        {
          id,
          meetingId: null,
          resolutionId: r.id,
          kind: rule.kind,
          memberId: about ? (r.actionMemberId ?? null) : null,
          office: about ? (r.actionOffice ?? null) : null,
          title: fill(rule.title).slice(0, 150),
          dueAt: waitsFor || rule.dueDays == null ? null : new Date(Date.now() + rule.dueDays * DAY_MS).toISOString(),
          doneAt: null,
          waitsFor,
          target: rule.target,
        },
        rule.kind === 'UPLOAD_STATUTES'
          ? `${description}\n${statutesHint}`
          : rule.targetName
            ? `${description}\n${targetHint(rule.kind, rule.targetName)}`
            : description,
        this.assigneesFor(rule, chosen, meeting, r),
        null,
        rule.checklist.map((t) => fill(t).slice(0, 200)),
        rule.dueDays,
      );
      previous = id;
    }
  }

  /** server: FollowUpPlanner.ownFollowUps — tasks given with a motion (IMPLEMENT), at most 10. */
  private ownFollowUps(viewer: Member, given: unknown, action: ResolutionAction): FollowUpRule[] {
    if (!Array.isArray(given) || !given.length) return [];
    if (given.length > 10) fail(400, 'action-rules.too-many');
    return given.map((f: Record<string, any>) => {
      const kind: FollowUpRule['kind'] = f.kind ?? 'IMPLEMENT';
      if (kind !== 'IMPLEMENT' && !TARGETED_FOLLOW_UPS.includes(kind)) fail(400, 'action-rules.kind-invalid');
      const title = typeof f.title === 'string' ? f.title.trim() : '';
      if (!title || title.length > 150) fail(400, 'action-rules.title-invalid');
      if (f.dueDays != null && (!Number.isInteger(f.dueDays) || f.dueDays < 0 || f.dueDays > 365)) fail(400, 'action-rules.due-invalid');
      const assignTo: FollowUpAssignee = f.assignTo ?? 'DEFAULT';
      if ((assignTo === 'OFFICE') !== !!f.office || (assignTo === 'MEMBER' && !NAMES_MEMBER.includes(action)))
        fail(400, 'action-rules.assignee-invalid');
      const description = typeof f.description === 'string' && f.description.trim() ? f.description.trim() : null;
      if (description && description.length > 2000) fail(400, 'action-rules.description-invalid');
      return {
        id: f.id ?? crypto.randomUUID(),
        kind,
        title,
        dueDays: f.dueDays ?? null,
        assignTo,
        office: assignTo === 'OFFICE' ? f.office : null,
        description,
        checklist: cleanChecklist(f.checklist, 'action-rules.checklist-invalid'),
        afterPrevious: f.afterPrevious === true,
        ...this.target(viewer, kind, f.target, {}),
      };
    });
  }

  /** server: FollowUpTargets — the folder, meeting type or appointment type, named as the viewer sees it; known ones keep their name. */
  private target(
    viewer: Member,
    kind: FollowUpRule['kind'],
    target: unknown,
    known: Record<string, string>,
  ): { target: string | null; targetName: string | null } {
    const value = typeof target === 'string' && target.trim() ? target.trim() : null;
    if (TARGETED_FOLLOW_UPS.includes(kind) !== !!value) fail(400, 'action-rules.target-invalid');
    if (!value) return { target: null, targetName: null };
    const kept = known[`${kind}:${value}`];
    if (kept) return { target: value, targetName: kept };
    const name =
      kind === 'UPLOAD_FILE'
        ? files.listFolders(viewer).find((f) => f.id === value)?.name
        : kind === 'INVITE_MEETING'
          ? this.types.data.find((t) => t.key === value && !t.archived)?.label
          : appointmentTypes.list().items.find((t) => t.key === value && !t.archived)?.label;
    return { target: value, targetName: name ?? fail(400, 'action-rules.target-unknown') };
  }

  /** server: ResolutionHandlers.assigneesFor */
  private assigneesFor(rule: FollowUpRule, chosen: readonly string[], meeting: StoredMeeting | null, r: StoredResolution): readonly string[] {
    const active = (id: string | null | undefined) => !!id && this.people.members.data.some((m) => m.id === id && m.active);
    switch (rule.assignTo) {
      case 'BOARD':
        return this.people.electorate('BOARD');
      case 'OFFICE': {
        const holders = this.people.offices.data.filter((o) => o.office === rule.office && !o.endedOn).map((o) => o.memberId);
        return holders.length ? holders : this.people.electorate('BOARD');
      }
      case 'MANAGER': {
        const manager = meeting ? meeting.createdBy : r.createdBy;
        return active(manager) ? [manager!] : chosen;
      }
      case 'MEMBER':
        return active(r.actionMemberId) ? [r.actionMemberId!] : chosen;
      default:
        return chosen;
    }
  }

  // --- resolution rules (server: MeetingTypeHandlers.saveRules, FollowUpPlanner.validate) ---

  saveRules(viewer: Member, body: Record<string, any>): ResolutionRules {
    this.people.requirePrivileged(viewer, ADMIN_BOARD);
    const items: Record<string, any>[] = Array.isArray(body.items) ? body.items : [];
    // server: FollowUpPlanner.validate — every built-in once, the club's own named; MeetingTypeHandlers.saveRules gives new ones a key
    const keyed: Record<string, any>[] = items.map((i) => ({
      ...i,
      action: i.action ?? `DECISION_${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`,
    }));
    if (
      new Set(keyed.map((i) => i.action)).size !== keyed.length ||
      ACTIONS.some((a) => !keyed.some((i) => i.action === a)) ||
      keyed.some((i) => !/^[A-Z][A-Z0-9_]{0,59}$/.test(i.action)) ||
      this.rules.data.some((old) => !keyed.some((i) => i.action === old.action))
    ) {
      fail(400, 'action-rules.invalid');
    }
    // server: MeetingTypeHandlers.withTargetNames — targets chosen before keep their names
    const known: Record<string, string> = {};
    for (const r of this.rules.data) for (const f of r.followUps) if (f.target && f.targetName) known[`${f.kind}:${f.target}`] = f.targetName;
    const rules: ActionRule[] = keyed.map((item) => {
      const action: ResolutionAction = item.action;
      const own = isOwnAction(action);
      const label = typeof item.label === 'string' ? item.label.trim() : null;
      if (own ? !label || label.length > 60 : label) fail(400, 'action-rules.label-invalid');
      const majority = item.majority ?? null;
      if (majority && !ALL_MAJORITIES.includes(majority)) fail(400, 'action-rules.invalid');
      const followUps: Record<string, any>[] = Array.isArray(item.followUps) ? item.followUps : fail(400, 'action-rules.invalid');
      if (followUps.length > 10) fail(400, 'action-rules.too-many');
      return {
        action,
        label: own ? label : null,
        majority,
        enabled: action === 'GENERAL' || item.enabled !== false,
        followUps: followUps.map((f) => {
          const automatic = OWN_ACTION[f.kind as FollowUpKind];
          if (
            !FOLLOW_UP_KINDS.includes(f.kind) ||
            (automatic && automatic !== action) ||
            (own && f.kind !== 'IMPLEMENT' && !TARGETED_FOLLOW_UPS.includes(f.kind))
          )
            fail(400, 'action-rules.kind-invalid');
          const title = typeof f.title === 'string' ? f.title.trim() : '';
          if (!title || title.length > 150) fail(400, 'action-rules.title-invalid');
          if (f.dueDays != null && (!Number.isInteger(f.dueDays) || f.dueDays < 0 || f.dueDays > 365)) fail(400, 'action-rules.due-invalid');
          // server: FollowUpPlanner.validate — who, text, checklist, order
          const assignTo: FollowUpAssignee = f.assignTo ?? 'DEFAULT';
          if (!ASSIGNEES.includes(assignTo)) fail(400, 'action-rules.assignee-invalid');
          if ((assignTo === 'OFFICE') !== !!f.office || (assignTo === 'MEMBER' && !NAMES_MEMBER.includes(action)))
            fail(400, 'action-rules.assignee-invalid');
          const description = typeof f.description === 'string' && f.description.trim() ? f.description.trim() : null;
          if (description && description.length > 2000) fail(400, 'action-rules.description-invalid');
          const checklist = cleanChecklist(f.checklist, 'action-rules.checklist-invalid');
          const afterPrevious = f.afterPrevious === true;
          if (afterPrevious && followUps.indexOf(f) === 0) fail(400, 'action-rules.chain-invalid');
          return {
            id: f.id ?? crypto.randomUUID(),
            kind: f.kind,
            title,
            dueDays: f.dueDays ?? null,
            assignTo,
            office: assignTo === 'OFFICE' ? f.office : null,
            description,
            checklist,
            afterPrevious,
            ...this.target(viewer, f.kind, f.target, known),
          };
        }),
      };
    });
    for (const rule of rules) {
      if (rule.enabled && rule.majority && this.types.data.some((t) => t.actions.includes(rule.action!) && !t.majorities.includes(rule.majority!))) {
        fail(400, 'meeting-type.majority-for-action');
      }
    }
    const circular = body.circular ?? {};
    if (!Number.isInteger(circular.minHours) || circular.minHours < 1 || circular.minHours > 720 || !QUORUMS.includes(circular.quorum)) {
      fail(400, 'action-rules.circular-invalid');
    }
    // server: MeetingTypeHandlers.saveRules — a removed decision leaves every meeting type that offered it
    const removed = rules.filter((r) => !r.enabled).map((r) => r.action!);
    const stripped = this.types.data.filter((t) => t.actions.some((a) => removed.includes(a)));
    for (const t of stripped) t.actions = t.actions.filter((a) => !removed.includes(a));
    if (stripped.length) this.typesChanged();
    this.rules.data.splice(0, this.rules.data.length, ...rules);
    this.rules.save();
    const statutes = this.statutesPlace(viewer, body.statutes);
    Object.assign(this.circular.data, { minHours: circular.minHours, quorum: circular.quorum });
    this.circular.save();
    Object.assign(this.statutes.data, statutes);
    this.statutes.save();
    mockServer.events.publish({ type: 'meetings.action-rules-changed', data: {} });
    return { items: this.rules.data, circular: this.circular.data, statutes: this.statutes.data };
  }

  /** server: MeetingTypeHandlers.statutes — names as the viewer sees them; unchanged ids keep the stored place. */
  private statutesPlace(viewer: Member, input: Record<string, any> | null | undefined): StatutesPlace {
    if (!input || (!input.fileId && !input.folderId)) return { ...NO_STATUTES };
    const stored = this.statutes.data;
    if ((stored.fileId ?? null) === (input.fileId ?? null) && (stored.folderId ?? null) === (input.folderId ?? null)) return { ...stored };
    const folders = files.listFolders(viewer);
    const folder = input.folderId ? (folders.find((f) => f.id === input.folderId) ?? fail(400, 'action-rules.statutes-unknown')) : null;
    let fileName: string | null = null;
    if (input.fileId) {
      const file = folders.flatMap((f) => files.listFiles(viewer, f.id)).find((f) => f.id === input.fileId);
      fileName = file?.name ?? fail(400, 'action-rules.statutes-unknown');
    }
    return { fileId: input.fileId ?? null, fileName, folderId: folder?.id ?? null, folderName: folder?.name ?? null };
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
    // server: ResolutionHandlers.createFollowUp — only an open follow-up of the same meeting or resolution can come first
    const waitsFor: string | null = body.waitsFor ?? null;
    if (waitsFor) {
      const meetingOf = meetingId ?? this.resolutions.data.find((x) => x.id === resolutionId)?.meetingId ?? null;
      const ok = this.followUps.data.some(
        (f) => f.id === waitsFor && !f.doneAt && ((meetingOf && f.meetingId === meetingOf) || (resolutionId && f.resolutionId === resolutionId)),
      );
      if (!ok) fail(400, 'meeting.follow-up-waits-invalid');
    }
    const checklist = cleanChecklist(body.checklist, 'meeting.follow-up-checklist-invalid');
    const due = typeof body.dueAt === 'string' && body.dueAt ? body.dueAt : null;
    const dueDays = waitsFor && due ? Math.max(0, Math.min(365, Math.floor((Date.parse(due) - Date.now()) / DAY_MS))) : null;
    const chosen = this.checkedAssignees(body.assigneeIds, allowed);
    const managers = this.people.audienceIds({ roles: ADMIN_BOARD });
    const assignees = chosen.length ? chosen : allowed.filter((id) => managers.includes(id));
    const f: StoredFollowUp = {
      id: crypto.randomUUID(),
      meetingId,
      resolutionId,
      kind: 'MANUAL',
      memberId: null,
      office: null,
      title,
      dueAt: waitsFor ? null : due,
      doneAt: null,
      waitsFor,
    };
    this.createFollowUp(f, text(body.description, 2000, 'request.invalid'), assignees, viewer.id, checklist, dueDays);
    return this.followUpDtos([f])[0];
  }

  /** server: ResolutionHandlers.setLinks */
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
    if (new Date().toISOString() > latestInvite(this.type(meeting.kind), meeting.startsAt)) fail(409, 'meeting.notice-too-short');
    meeting.status = 'INVITED';
    meeting.invitedAt = new Date().toISOString();
    this.changed(meeting, 'INVITED');
    // server: an extraordinary general meeting = an assembly that is not the yearly one
    if (isAssembly(this.type(meeting.kind)) && !this.type(meeting.kind).dueBy) this.complete((f) => f.kind === 'CONVENE_ASSEMBLY');
    this.complete((f) => f.kind === 'INVITE_MEETING' && f.target === meeting.kind && !f.pending);
    mockServer.events.publish({
      type: 'meetings.meeting-invited',
      data: {
        meetingId: meeting.id,
        recipients: this.electorate(meeting.kind),
        kind: meeting.kind,
        title: meeting.title,
        agenda: meeting.agenda,
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
    if (mode === 'ONLINE' && !this.type(meeting.kind).online) fail(400, 'meeting.not-online');
    if (mode === 'APP' || mode === 'ANALOG' || mode === 'ONLINE') meeting.presence[memberId] = mode;
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

  createResolution(viewer: Member, meetingId: string | null, body: Record<string, any>): Resolution {
    this.people.requirePrivileged(viewer, ADMIN_BOARD);
    const meeting = meetingId ? this.managed(viewer, meetingId) : null;
    if (!meeting && !this.runsCircular(viewer)) fail(403, 'access.denied');
    if (meeting?.status === 'CLOSED') fail(409, 'meeting.closed');
    // server: FollowUpPlanner.check
    const action = (body.action ?? 'GENERAL') as ResolutionAction;
    const type = meeting ? this.type(meeting.kind) : null;
    if (!this.rules.data.some((r) => r.action === action)) fail(400, 'resolution.action-unknown');
    if (!actions(type, this.rules.data).includes(action) || this.rules.data.find((r) => r.action === action)!.enabled === false)
      fail(400, 'resolution.action-not-here');
    if (actionNeedsMember(action) !== !!body.actionMemberId) fail(400, 'resolution.action-member-missing');
    if ((action === 'ELECTION') !== !!body.actionOffice) fail(400, 'resolution.action-office-missing');
    const requested = (meeting ? (body.majority ?? null) : 'SIMPLE') as Majority | null;
    const implied = this.rules.data.find((x) => x.action === action)?.majority ?? requested;
    if (requested && implied !== requested) fail(400, 'resolution.majority-mismatch');
    const majority = implied && majorities(type).includes(implied) ? implied : fail(400, 'resolution.majority-invalid');
    const assigneeIds = this.checkedAssignees(body.assigneeIds, this.assignable(null, meeting, action !== 'GENERAL'));
    const title = text(body.title, 200, 'resolution.title-invalid') ?? fail(400, 'resolution.title-invalid');
    const deadline = meeting
      ? null
      : typeof body.deadline === 'string'
        ? new Date(body.deadline).toISOString()
        : fail(400, 'resolution.deadline-invalid');
    const r: StoredResolution = {
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
      action,
      actionMemberId: body.actionMemberId ?? null,
      actionOffice: body.actionOffice ?? null,
      assigneeIds,
      ownFollowUps: this.ownFollowUps(viewer, body.followUps, action),
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
    if (!meeting && Date.parse(r.deadline!) < Date.now() + this.circular.data.minHours * 3_600_000) fail(400, 'resolution.deadline-too-short');
    const voters = this.voters(r);
    Object.assign(r, { status: 'OPEN', openedAt: new Date().toISOString(), voters: voters.length, frozenVoters: meeting ? undefined : voters });
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
    tasks.deadline(`deadline-circular-${r.id}`, `Umlaufbeschluss: ${r.title}`, 'Der Umlaufbeschluss schließt dann von selbst.', next, [viewer.id]);
    this.resolutionChanged(r, 'UPDATED');
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
    const [yes, no, abstain] = [body.yes, body.no, body.abstain].map((v) =>
      Number.isInteger(v) && v >= 0 ? (v as number) : fail(400, 'resolution.analog-invalid'),
    );
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
    const passes =
      valid > 0 && (r.majority === 'SIMPLE' ? yes * 2 > valid : r.majority === 'TWO_THIRDS' ? yes * 3 >= valid * 2 : yes * 4 >= valid * 3);
    const result =
      !r.meetingId && !quorumReached(this.circular.data.quorum, r.ballots.length, r.voters ?? 0) ? 'NOT_QUORATE' : passes ? 'PASSED' : 'FAILED';
    Object.assign(r, { status: 'CLOSED', closedAt: new Date().toISOString(), result });
    const meeting = r.meetingId ? this.meetings.data.find((m) => m.id === r.meetingId)! : null;
    if (result === 'PASSED' && (!meeting || meeting.autoTasks !== false)) this.planFollowUps(r, meeting);
    if (!meeting) tasks.deadlineDone(`deadline-circular-${r.id}`);
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
    const {
      yes,
      no,
      abstain,
      ballots,
      action: _a,
      actionMemberId: _m,
      actionOffice: _o,
      assigneeIds: _as,
      frozenVoters: _f,
      links: _l,
      ownFollowUps,
      createdBy: _c,
      ...rest
    } = r;
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
      ownFollowUps: ownFollowUps ?? [],
      yes: closed ? yes : null,
      no: closed ? no : null,
      abstain: closed ? abstain : null,
      analogYes: closed ? r.analogYes : null,
      analogNo: closed ? r.analogNo : null,
      analogAbstain: closed ? r.analogAbstain : null,
      analogEntered: r.analogYes !== null,
      analogPresent: this.analogPresent(r),
      ballots: ballots.length,
      voted: ballots.includes(viewer.id),
      canVote: r.status === 'OPEN' && !ballots.includes(viewer.id) && voters.includes(viewer.id) && (mode === 'APP' || mode === 'ONLINE'),
      canManage: manages,
      pending:
        !r.meetingId && r.status === 'OPEN' && manages
          ? voters.filter((id) => !ballots.includes(id)).map((id) => ({ memberId: id, name: name(id) }))
          : [],
      action: r.action ?? 'GENERAL',
      actionMember: r.actionMemberId ? { memberId: r.actionMemberId, name: name(r.actionMemberId) } : null,
      actionOffice: r.actionOffice ?? null,
      assignees: (r.assigneeIds ?? []).map((id) => ({ memberId: id, name: name(id) })),
      followUps: this.followUpDtos(this.followUps.data.filter((f) => f.resolutionId === r.id)),
      assignable: manages
        ? this.assignable(
            r,
            r.meetingId ? this.meetings.data.find((m) => m.id === r.meetingId)! : null,
            r.status !== 'CLOSED' && (r.action ?? 'GENERAL') !== 'GENERAL',
          )
            .map((id) => ({ memberId: id, name: name(id) }))
            .sort((a, b) => a.name.localeCompare(b.name))
        : [],
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
    const conveners = subset(body.conveners, OFFICES);
    const actions = subset(body.actions, ACTIONS);
    if (body.electorate !== 'BOARD' && body.electorate !== 'ASSEMBLY') fail(400, 'meeting-type.electorate-invalid');
    if (!Number.isInteger(body.noticeHours) || body.noticeHours < 0 || body.noticeHours > 8760) fail(400, 'meeting-type.notice-invalid');
    if (!QUORUMS.includes(body.quorum)) fail(400, 'meeting-type.quorum-invalid');
    if (body.graceMinutes != null && (!Number.isInteger(body.graceMinutes) || body.graceMinutes < 1 || body.graceMinutes > 1440))
      fail(400, 'meeting-type.grace-invalid');
    if (!majorities.length) fail(400, 'meeting-type.majorities-missing');
    if (!conveners.length || conveners.includes('AUDITOR')) fail(400, 'meeting-type.conveners-invalid');
    if (!actions.includes('GENERAL')) fail(400, 'meeting-type.actions-invalid');
    if (actions.some((a: string) => !this.rules.data.some((r) => r.action === a))) fail(400, 'meeting-type.action-unknown');
    if (this.rules.data.some((r) => r.majority && actions.includes(r.action!) && !majorities.includes(r.majority)))
      fail(400, 'meeting-type.majority-for-action');
    if (this.rules.data.some((r) => r.enabled === false && actions.includes(r.action!))) fail(400, 'meeting-type.action-removed');
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
      actions,
      needsReason: !!body.needsReason,
      dueBy,
      sort: Number.isInteger(body.sort) ? body.sort : 0,
      archived: !!body.archived,
      online: !!body.online,
      videoUrl: body.online && typeof body.videoUrl === 'string' && body.videoUrl.trim() ? body.videoUrl.trim() : null,
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

  /** server: MeetingType.mayConvene */
  private mayConvene(viewer: Member, kind: MeetingKind): boolean {
    return mayConvene(this.type(kind), viewer.roles.includes('ADMIN'), this.offices(viewer));
  }

  private maySee(viewer: Member, m: StoredMeeting): boolean {
    if (this.people.hasRole(viewer, ADMIN_BOARD)) return true;
    return isAssembly(this.type(m.kind)) && viewer.voter;
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
    const { presence, frozenElectorate: _frozen, ...rest } = m;
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
      autoTasks: m.autoTasks !== false,
      followUps: this.followUpDtos(this.followUps.data.filter((f) => f.meetingId === m.id && !f.resolutionId)),
      latestInvite: latestInvite(this.type(m.kind), m.startsAt),
      electorate: voters.map((id) => ({ memberId: id, name: name(id) })).sort(byName),
      present: Object.entries(presence)
        .map(([id, mode]) => ({ memberId: id, name: name(id), mode }))
        .sort(byName),
      quorate: this.quorate(m, voters),
      canManage: this.mayConvene(viewer, m.kind) || this.offices(viewer).includes('SECRETARY'),
      assignable:
        this.mayConvene(viewer, m.kind) || this.offices(viewer).includes('SECRETARY')
          ? this.assignable(null, m, false)
              .map((id) => ({ memberId: id, name: name(id), manager: this.assignable(null, m, true).includes(id) }))
              .sort(byName)
          : [],
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
const actor = (req: MockRequest) => directory.actor(req);

mockServer
  .on('GET', '/api/v1/meetings', (req) => meetings.list(actor(req), req.query.get('from'), req.query.get('to')))
  .on(
    'GET',
    '/api/v1/meetings/resolution-rules',
    (req) => (
      actor(req),
      {
        items: meetings.rules.data.map((r) => ({
          ...r,
          enabled: r.enabled !== false,
          // rules stored before the workflow options
          followUps: r.followUps.map((f) => ({ ...plainFollowUp(f.kind, f.title, f.dueDays), ...f })),
        })),
        circular: meetings.circular.data,
        statutes: meetings.statutes.data,
      }
    ),
  )
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
  .on('GET', '/api/v1/meetings/:id/resolutions', (req) => meetings.listResolutions(actor(req), req.params.id))
  .on('POST', '/api/v1/meetings/:id/resolutions', (req) => meetings.createResolution(actor(req), req.params.id, req.body ?? {}))
  .on('GET', '/api/v1/resolutions', (req) => meetings.listResolutions(actor(req), null))
  .on('POST', '/api/v1/resolutions', (req) => meetings.createResolution(actor(req), null, req.body ?? {}))
  .on('GET', '/api/v1/resolutions/:id', (req) => meetings.getResolution(actor(req), req.params.id))
  .on('DELETE', '/api/v1/resolutions/:id', (req) => meetings.deleteResolution(actor(req), req.params.id))
  .on('POST', '/api/v1/resolutions/:id/open', (req) => meetings.openResolution(actor(req), req.params.id))
  .on('POST', '/api/v1/resolutions/:id/close', (req) => meetings.closeResolution(actor(req), req.params.id))
  .on('PUT', '/api/v1/resolutions/:id/deadline', (req) => meetings.extendDeadline(actor(req), req.params.id, req.body?.deadline))
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
  .on('PUT', '/api/v1/meetings/:id/presence/:memberId', (req) =>
    meetings.setPresence(actor(req), req.params.id, req.params.memberId, req.body?.mode),
  );
