import type { LinkedRef } from '../../lib/records/refs';
import type { Hue } from '../../lib/types';
import type { OfficeKind } from '../members/MembersApi';
import type { Trigger } from './triggers';

// Mirrors of the club-server meetings DTOs. API times are UTC instants.

/** Key of a club-defined meeting type (server: meetings_type); seeded with ASSEMBLY, BOARD, … */
export type MeetingKind = string;
export type MeetingStatus = 'DRAFT' | 'INVITED' | 'OPEN' | 'CLOSED';
/** APP votes in the app; ANALOG is there without the app (in the room or on video). */
/** APP: votes in the app; ANALOG: votes through the minute taker; ONLINE: joins by video, votes in the app. */
export type PresenceMode = 'APP' | 'ANALOG' | 'ONLINE';

export const STATUS_LABELS: Readonly<Record<MeetingStatus, string>> = { DRAFT: 'Entwurf', INVITED: 'Eingeladen', OPEN: 'Läuft', CLOSED: 'Beendet' };
export const STATUS_TONES: Readonly<Record<MeetingStatus, Hue>> = { DRAFT: 'gray', INVITED: 'blue', OPEN: 'green', CLOSED: 'brown' };

/** server: MeetingsApi.Quorum — of the electorate present: at least half, more than half, at least three quarters. */
export type Quorum = 'AT_LEAST_HALF' | 'MORE_THAN_HALF' | 'AT_LEAST_THREE_QUARTERS';
export const QUORUM_LABELS: Readonly<Record<Quorum, string>> = {
  AT_LEAST_HALF: 'mindestens die Hälfte',
  MORE_THAN_HALF: 'mehr als die Hälfte',
  AT_LEAST_THREE_QUARTERS: 'mindestens drei Viertel',
};

/** server: MeetingsApi.StepAnchor — before the last day to invite (drafts), before the start (once invited), after the end. */
export type StepAnchor = 'BEFORE_INVITE' | 'BEFORE_START' | 'AFTER_END';
export type StepAction = 'NOTIFICATION' | 'TASK';
/** BOARD: the board and who created the meeting; CONVENERS: holders of the convening offices. */
export type StepAudience = 'ELECTORATE' | 'BOARD' | 'CONVENERS' | 'SECRETARY';
/** The server's own reminders: invitation due, meeting starts soon (texts by the server). */
export type SystemStep = 'INVITE_REMINDER' | 'START_REMINDER';

/** server: MeetingsApi.StepDto — a notification or task a set time around each meeting of the type. */
export interface MeetingStep {
  /** null until saved. */
  id: string | null;
  anchor: StepAnchor;
  offsetHours: number;
  action: StepAction;
  audience: StepAudience;
  /** With {titel} and {datum}; null for system steps. */
  title: string | null;
  body: string | null;
  system: SystemStep | null;
}

export const AUDIENCE_LABELS: Readonly<Record<StepAudience, string>> = {
  ELECTORATE: 'Alle Stimmberechtigten',
  BOARD: 'Vorstand und wer sie angelegt hat',
  CONVENERS: 'Wer einberuft',
  SECRETARY: 'Schriftführung',
};
export const ACTION_KIND_LABELS: Readonly<Record<StepAction, string>> = { NOTIFICATION: 'Benachrichtigung', TASK: 'Aufgabe' };
export const SYSTEM_STEP_LABELS: Readonly<Record<SystemStep, string>> = {
  INVITE_REMINDER: 'Einladung fällig',
  START_REMINDER: 'Erinnerung an die Sitzung',
};
/** "3 Tage vor Beginn": where a step's offset counts from. */
export const STEP_ANCHOR_TEXT: Readonly<Record<StepAnchor, string>> = {
  BEFORE_INVITE: 'vor der Einladungsfrist',
  BEFORE_START: 'vor Beginn',
  AFTER_END: 'nach dem Ende',
};

/** server: MeetingsApi.MeetingTypeDto. */
export interface MeetingType {
  key: MeetingKind;
  label: string;
  /** After "Einladung zur": "ordentlichen Mitgliederversammlung". */
  invitationLabel: string;
  /** Who is invited, votes and counts for the quorum. */
  electorate: 'BOARD' | 'ASSEMBLY';
  noticeHours: number;
  quorum: Quorum;
  /** Not quorate at the hour → this many minutes later whoever is there decides. */
  graceMinutes: number | null;
  majorities: Majority[];
  /** Offices that convene it; admins always may. */
  conveners: OfficeKind[];
  actions: ResolutionAction[];
  /** States the reason of its urgency in the invitation. */
  needsReason: boolean;
  /** Held yearly, planned by this day ("MM-DD"). */
  dueBy: string | null;
  sort: number;
  archived: boolean;
  /** Members may join its meetings online; each shows its own link or the type's standing `videoUrl`. */
  online: boolean;
  videoUrl: string | null;
  /** Meetings of this type exist: it can be archived, not deleted. */
  inUse: boolean;
  steps: MeetingStep[];
}

export type MeetingTypeInput = Omit<MeetingType, 'key' | 'inUse'>;

export const isAssembly = (type: MeetingType | undefined): boolean => type?.electorate === 'ASSEMBLY';

const HOUR = 3_600_000;

/** server: MeetingType.latestInvite — the last moment an invitation keeps the notice period. */
export const latestInvite = (type: MeetingType, startsAt: string): string =>
  new Date(new Date(startsAt).getTime() - type.noticeHours * HOUR).toISOString();

/** The quorum rule in words, next to the presence list. */
export const quorumText = (type: MeetingType): string =>
  QUORUM_LABELS[type.quorum] + (type.graceMinutes ? `; ${type.graceMinutes} Minuten nach Beginn unabhängig von der Anzahl` : '');

/** server: MeetingType.mayConvene — admins act for the conveners. */
export const mayConvene = (type: MeetingType, admin: boolean, offices: readonly OfficeKind[]): boolean =>
  admin || type.conveners.some((o) => offices.includes(o));

/** server: Quorum.reached — `count` of `total` reach the share; nobody of nobody does not. */
export function quorumReached(quorum: Quorum, count: number, total: number): boolean {
  if (!count || !total) return false;
  if (quorum === 'AT_LEAST_HALF') return count * 2 >= total;
  if (quorum === 'MORE_THAN_HALF') return count * 2 > total;
  return count * 4 >= total * 3;
}

/** server: MeetingType.isQuorate; `present` counts only the electorate. */
export function isQuorate(type: MeetingType, present: number, voters: number, startsAt: string, now: number): boolean {
  if (!voters || !present) return false;
  if (type.graceMinutes && now >= Date.parse(startsAt) + type.graceMinutes * 60_000) return true;
  return quorumReached(type.quorum, present, voters);
}

/** A day of the year ("MM-DD"; 29 February allowed), as the yearly meetings' day (server: MeetingType.parseDueBy). */
export function isDayOfYear(month: number, day: number): boolean {
  return Number.isInteger(month) && Number.isInteger(day) && new Date(2024, month - 1, day).getMonth() === month - 1 && day >= 1;
}

/** "14 Tage", "48 Stunden" (server: MeetingReminders.duration). */
export function noticeText(hours: number): string {
  if (hours % 24) return `${hours} ${hours === 1 ? 'Stunde' : 'Stunden'}`;
  const days = hours / 24;
  return `${days} ${days === 1 ? 'Tag' : 'Tage'}`;
}

export interface Person {
  memberId: string;
  name: string;
}

export interface Presence extends Person {
  mode: PresenceMode;
}

export interface Meeting {
  id: string;
  kind: MeetingKind;
  title: string;
  agenda: string | null;
  /** Reason of the urgency, for types that need one (seeded: extraordinary board meeting). */
  urgency: string | null;
  startsAt: string;
  endsAt: string;
  location: string | null;
  /** Its type has online participation: `videoUrl` is the link members join by (its own, or the type's). */
  online: boolean;
  videoUrl: string | null;
  status: MeetingStatus;
  invitedAt: string | null;
  openedAt: string | null;
  closedAt: string | null;
  protocol: string | null;
  latestInvite: string;
  /** Who votes and counts for the quorum. */
  electorate: Person[];
  present: Presence[];
  quorate: boolean;
  /** The viewer may edit, invite, take presence, open and close. */
  canManage: boolean;
  /** Linked records (files, members, appointments, ...) with the title they had when linked. */
  links: LinkedRef[];
  /** Passed resolutions get their follow-up tasks. */
  autoTasks: boolean;
  /** The meeting's own tasks (those of its resolutions are on the resolutions). */
  followUps: FollowUp[];
  /** Who runs it: those present; `manager` (admin, board) for tasks that need those rights. */
  assignable: Assignable[];
}

export interface Assignable extends Person {
  manager: boolean;
}

// --- follow-up tasks (server: MeetingsApi.FollowUpDto, FollowUpPlanner) ---

/** The built-in decisions; the club adds its own (`DECISION_…`, named in its ActionRule), which behave like GENERAL. */
export type BuiltinAction =
  'GENERAL' | 'HONORARY_GRANT' | 'HONORARY_REVOKE' | 'ELECTION' | 'STATUTES_CHANGE' | 'DISSOLUTION' | 'EXCLUSION' | 'CONVENE_ASSEMBLY';

/** A decision key: a built-in one or the club's own. */
export type ResolutionAction = string;

export const ACTION_LABELS: Readonly<Record<BuiltinAction, string>> = {
  GENERAL: 'Sonstiger Beschluss',
  HONORARY_GRANT: 'Ehrenmitgliedschaft verleihen',
  HONORARY_REVOKE: 'Ehrenmitgliedschaft aberkennen',
  ELECTION: 'Wahl in eine Funktion',
  STATUTES_CHANGE: 'Statutenänderung',
  DISSOLUTION: 'Auflösung des Vereins',
  EXCLUSION: 'Ausschluss eines Mitglieds',
  CONVENE_ASSEMBLY: 'Außerordentliche Mitgliederversammlung einberufen',
};

export const ACTION_ORDER: readonly BuiltinAction[] = Object.keys(ACTION_LABELS) as BuiltinAction[];

/** One of the club's own decisions (server: MeetingsApi.ActionRule.own). */
export const isOwnAction = (action: ResolutionAction): boolean => !(action in ACTION_LABELS);

/** The decision's name: built-in, or the club's from its rule. */
export function actionLabel(action: ResolutionAction, rules: readonly ActionRule[] = []): string {
  return ACTION_LABELS[action as BuiltinAction] ?? rules.find((r) => r.action === action)?.label ?? action;
}

/** Every decision in display order: built-in ones, then the club's own by name. */
export function allActions(rules: readonly ActionRule[]): ResolutionAction[] {
  const own = rules
    .filter((r) => r.action && isOwnAction(r.action))
    .sort((a, b) => (a.label ?? '').localeCompare(b.label ?? '', 'de'))
    .map((r) => r.action!);
  return [...ACTION_ORDER, ...own];
}

/** server: FollowUpPlanner.actions — `null` = circular vote (with the club's own decisions). */
export function actions(type: MeetingType | null, rules: readonly ActionRule[] = []): ResolutionAction[] {
  const all = allActions(rules);
  return type ? all.filter((a) => type.actions.includes(a)) : all.filter((a) => a === 'GENERAL' || a === 'CONVENE_ASSEMBLY' || isOwnAction(a));
}

export const actionNeedsMember = (a: ResolutionAction): boolean => ['HONORARY_GRANT', 'HONORARY_REVOKE', 'ELECTION', 'EXCLUSION'].includes(a);

/** server: MeetingsApi.FollowUpRule — `title` fills {beschluss}, {mitglied}, {funktion}; `dueDays` null: no due date. */
/**
 * server: MeetingsApi.FollowUpAssignee — who carries out a follow-up: DEFAULT the resolution's assignees (else the managers present, else
 * the board), BOARD, OFFICE the holders of `office` (the board while vacant), MANAGER who started the meeting or vote, MEMBER the member
 * the decision is about.
 */
export type FollowUpAssignee = 'DEFAULT' | 'BOARD' | 'OFFICE' | 'MANAGER' | 'MEMBER';

export const ASSIGNEE_LABELS: Readonly<Record<FollowUpAssignee, string>> = {
  DEFAULT: 'Wie im Beschluss gewählt',
  BOARD: 'Vorstand',
  OFFICE: 'Eine Funktion',
  MANAGER: 'Wer die Sitzung leitet',
  MEMBER: 'Betroffenes Mitglied',
};

/** server: FollowUp.AUTOMATIC — kinds that finish themselves once their effect is entered. */
export const AUTOMATIC_FOLLOW_UPS: readonly FollowUpKind[] = [
  'ENTER_HONORARY',
  'REVOKE_HONORARY',
  'ENTER_OFFICE',
  'CONVENE_ASSEMBLY',
  'UPLOAD_STATUTES',
];

/** A follow-up for the resolution's assignees, without description or checklist, at once. */
export const plainFollowUp = (kind: FollowUpRule['kind'], title: string, dueDays: number | null): FollowUpRule => ({
  id: null,
  kind,
  title,
  dueDays,
  assignTo: 'DEFAULT',
  office: null,
  description: null,
  checklist: [],
  afterPrevious: false,
  trigger: null,
});

/** server: FollowUpPlanner.NAMES_MEMBER — built-in decisions about one member. */
export const NAMES_MEMBER: readonly ResolutionAction[] = ['HONORARY_GRANT', 'HONORARY_REVOKE', 'ELECTION', 'EXCLUSION'];

/**
 * server: MeetingsApi.FollowUpRule — `title`, `description` and `checklist` fill {beschluss}, {mitglied}, {funktion}; `dueDays` counted
 * from the start; `afterPrevious`: starts only once the follow-up before it is done.
 */
export interface FollowUpRule {
  /** null until saved. */
  id: string | null;
  kind: Exclude<FollowUpKind, 'MANUAL'>;
  title: string;
  dueDays: number | null;
  assignTo: FollowUpAssignee;
  office: OfficeKind | null;
  description: string | null;
  checklist: string[];
  afterPrevious: boolean;
  /** TRIGGER: what finishes it. */
  trigger: Trigger | null;
}

/**
 * server: MeetingsApi.ActionRule — `action` null: a new decision of the club's own (the server gives it a key); `label`: its name (null for
 * built-ins); `majority`: fixed for the decision (statute change, dissolution), null: the resolution picks.
 */
export interface ActionRule {
  action: ResolutionAction | null;
  label: string | null;
  majority: Majority | null;
  followUps: FollowUpRule[];
  /** false: the club removed this decision, no meeting type offers it (GENERAL always stays). */
  enabled: boolean;
}

/** Follow-up kinds that finish themselves, each only after its own decision (server: FollowUpPlanner.OWN_ACTION). */
export const OWN_ACTION: Partial<Record<FollowUpKind, BuiltinAction>> = {
  ENTER_HONORARY: 'HONORARY_GRANT',
  REVOKE_HONORARY: 'HONORARY_REVOKE',
  ENTER_OFFICE: 'ELECTION',
  NOTIFY_EXCLUSION: 'EXCLUSION',
  CONVENE_ASSEMBLY: 'CONVENE_ASSEMBLY',
  UPLOAD_STATUTES: 'STATUTES_CHANGE',
};

/** How a follow-up gets done ("Erledigt durch"). */
export const FOLLOW_UP_KIND_LABELS: Readonly<Record<Exclude<FollowUpKind, 'MANUAL'>, string>> = {
  IMPLEMENT: 'Von Hand abhaken',
  ENTER_HONORARY: 'Von selbst, wenn die Ehrenmitgliedschaft eingetragen ist',
  REVOKE_HONORARY: 'Von selbst, wenn die Ehrenmitgliedschaft aberkannt ist',
  ENTER_OFFICE: 'Von selbst, wenn die Funktion eingetragen ist',
  NOTIFY_EXCLUSION: 'Von Hand: Ausschluss mitteilen',
  CONVENE_ASSEMBLY: 'Von selbst, wenn zur Mitgliederversammlung eingeladen ist',
  UPLOAD_STATUTES: 'Von selbst, wenn die neuen Statuten hochgeladen sind',
  TRIGGER: 'Von selbst, wenn … (Datei, Termin, Sitzung, Beschluss, Funktion, Mitglied, Turnier)',
};

/** server: FollowUpKind.targeted — open to every decision and motion, each waiting for a folder, meeting type or appointment type. */
export const TARGETED_FOLLOW_UPS: readonly FollowUpKind[] = ['TRIGGER'];

export type FollowUpKind =
  | 'IMPLEMENT'
  | 'ENTER_HONORARY'
  | 'REVOKE_HONORARY'
  | 'ENTER_OFFICE'
  | 'NOTIFY_EXCLUSION'
  | 'CONVENE_ASSEMBLY'
  | 'UPLOAD_STATUTES'
  | 'TRIGGER'
  | 'MANUAL';

export interface FollowUp {
  id: string;
  resolutionId: string | null;
  kind: FollowUpKind;
  title: string;
  /** Finishes itself when its effect is entered (honorary membership, office, invitation). */
  automatic: boolean;
  dueAt: string | null;
  /** null while the task is being created, or while it waits. */
  taskId: string | null;
  taskStatus: 'OPEN' | 'IN_PROGRESS' | 'DONE' | null;
  /** The follow-up it starts after. */
  waitsFor: string | null;
  /** No task yet: `waitsFor` is not done. */
  waiting: boolean;
}

export interface NewFollowUp {
  title: string;
  description: string | null;
  /** Empty = the board. */
  assigneeIds: string[];
  dueAt: string | null;
  checklist: string[];
  /** An open follow-up of the same meeting or resolution it starts after. */
  waitsFor: string | null;
}

export type MeetingSummary = Pick<Meeting, 'id' | 'kind' | 'title' | 'startsAt' | 'endsAt' | 'location' | 'status'>;

export interface NewMeeting {
  kind: MeetingKind;
  title: string;
  agenda: string | null;
  urgency: string | null;
  startsAt: string;
  endsAt: string;
  location: string | null;
  /** Its own link; empty: the type's standing one. */
  videoUrl: string | null;
}

/** Omitted fields stay, '' clears a text. Times only before the invitation, the protocol only while open. */
export type MeetingPatch = Partial<Omit<NewMeeting, 'kind'>> & { protocol?: string };

// --- resolutions (server: MeetingsApi.ResolutionDto) ---

/** Of the valid votes (yes + no; abstentions don't count). */
export type Majority = 'SIMPLE' | 'TWO_THIRDS' | 'THREE_QUARTERS';
export type ResolutionStatus = 'DRAFT' | 'OPEN' | 'CLOSED';
export type Choice = 'YES' | 'NO' | 'ABSTAIN';
/** NOT_QUORATE: a circular vote in which no more than half of the board took part. */
export type Result = 'PASSED' | 'FAILED' | 'NOT_QUORATE';

export const MAJORITY_LABELS: Readonly<Record<Majority, string>> = {
  SIMPLE: 'Mehr als die Hälfte',
  TWO_THIRDS: 'Zwei Drittel (Statutenänderung)',
  THREE_QUARTERS: 'Drei Viertel',
};

export const CHOICE_LABELS: Readonly<Record<Choice, string>> = { YES: 'Ja', NO: 'Nein', ABSTAIN: 'Enthaltung' };

export const RESULT_LABELS: Readonly<Record<Result, string>> = { PASSED: 'Angenommen', FAILED: 'Abgelehnt', NOT_QUORATE: 'Zu wenig Beteiligung' };
export const RESULT_TONES: Readonly<Record<Result, Hue>> = { PASSED: 'green', FAILED: 'red', NOT_QUORATE: 'orange' };

/** server: Resolution.majorities — `null` = circular vote. */
export function majorities(type: MeetingType | null): Majority[] {
  return type ? (['SIMPLE', 'TWO_THIRDS', 'THREE_QUARTERS'] as const).filter((m) => type.majorities.includes(m)) : ['SIMPLE'];
}

/** server: MeetingsApi.CircularRules — shortest voting time of a circular vote, and the share of the board that must take part. */
export interface CircularRules {
  minHours: number;
  quorum: Quorum;
}

export const SEEDED_CIRCULAR: CircularRules = { minHours: 72, quorum: 'MORE_THAN_HALF' };

/** server: MeetingsApi.ActionRules. */
/**
 * server: MeetingsApi.StatutesPlace — where the club keeps its statutes: a new version of the file finishes "Neue Statuten hochladen";
 * without a file, any upload into the folder. Names are the last known ones.
 */
export interface StatutesPlace {
  fileId: string | null;
  fileName: string | null;
  folderId: string | null;
  folderName: string | null;
}

export const NO_STATUTES: StatutesPlace = { fileId: null, fileName: null, folderId: null, folderName: null };

export interface ResolutionRules {
  items: ActionRule[];
  circular: CircularRules;
  statutes: StatutesPlace;
}

export interface Resolution {
  id: string;
  /** null = circular vote of the board. */
  meetingId: string | null;
  title: string;
  text: string | null;
  majority: Majority;
  status: ResolutionStatus;
  deadline: string | null;
  /** Electorate when the vote opened. */
  voters: number | null;
  /** How many voted (in the app or in writing). */
  ballots: number;
  /** The split, only once closed. */
  yes: number | null;
  no: number | null;
  abstain: number | null;
  analogYes: number | null;
  analogNo: number | null;
  analogAbstain: number | null;
  analogEntered: boolean;
  /** Members present without the app: the most the room may add. */
  analogPresent: number;
  result: Result | null;
  openedAt: string | null;
  closedAt: string | null;
  voted: boolean;
  canVote: boolean;
  canManage: boolean;
  /** Circular votes: board members who have not voted yet (for who runs it). */
  pending: Person[];
  action: ResolutionAction;
  /** Whom it is about (honorary membership, election, exclusion). */
  actionMember: Person | null;
  actionOffice: OfficeKind | null;
  /** Who carries it out; empty = the board. */
  assignees: Person[];
  followUps: FollowUp[];
  /** Who runs it: possible assignees (before closing: of its plan; afterwards: everyone present). */
  assignable: Person[];
  links: LinkedRef[];
  /** Follow-ups given with the motion, created after the decision's own ones once it passes. */
  ownFollowUps: FollowUpRule[];
}

export interface NewResolution {
  title: string;
  text: string | null;
  /** null where the action fixes it. */
  majority: Majority | null;
  action: ResolutionAction;
  actionMemberId: string | null;
  actionOffice: OfficeKind | null;
  assigneeIds: string[];
  /** Tasks of its own (IMPLEMENT), after the decision's ones. */
  followUps: FollowUpRule[];
}
