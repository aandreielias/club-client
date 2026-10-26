import type { LinkedRef } from '../../lib/records/refs';
import type { Hue } from '../../lib/types';
import type { OfficeKind } from '../members/MembersApi';

// Mirrors of the club-server meetings DTOs. API times are UTC instants.

/** Key of a club-defined meeting type (server: meetings_type); seeded with ASSEMBLY, BOARD, … */
export type MeetingKind = string;
export type MeetingStatus = 'DRAFT' | 'INVITED' | 'OPEN' | 'CLOSED';
/** APP votes in the app; ANALOG is there without the app (in the room or on video). */
export type PresenceMode = 'APP' | 'ANALOG';

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
export const SYSTEM_STEP_LABELS: Readonly<Record<SystemStep, string>> = { INVITE_REMINDER: 'Einladung fällig', START_REMINDER: 'Erinnerung an die Sitzung' };

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

export type ResolutionAction = 'GENERAL' | 'HONORARY_GRANT' | 'HONORARY_REVOKE' | 'ELECTION' | 'STATUTES_CHANGE' | 'DISSOLUTION' | 'EXCLUSION' | 'CONVENE_ASSEMBLY';

export const ACTION_LABELS: Readonly<Record<ResolutionAction, string>> = {
  GENERAL: 'Sonstiger Beschluss',
  HONORARY_GRANT: 'Ehrenmitgliedschaft verleihen',
  HONORARY_REVOKE: 'Ehrenmitgliedschaft aberkennen',
  ELECTION: 'Wahl in eine Funktion',
  STATUTES_CHANGE: 'Statutenänderung',
  DISSOLUTION: 'Auflösung des Vereins',
  EXCLUSION: 'Ausschluss eines Mitglieds',
  CONVENE_ASSEMBLY: 'Außerordentliche Mitgliederversammlung einberufen',
};

export const ACTION_ORDER: readonly ResolutionAction[] = Object.keys(ACTION_LABELS) as ResolutionAction[];

/** server: FollowUpPlanner.actions — `null` = circular vote. */
export function actions(type: MeetingType | null): ResolutionAction[] {
  return type ? ACTION_ORDER.filter((a) => type.actions.includes(a)) : ['GENERAL', 'CONVENE_ASSEMBLY'];
}

export const actionNeedsMember = (a: ResolutionAction): boolean => ['HONORARY_GRANT', 'HONORARY_REVOKE', 'ELECTION', 'EXCLUSION'].includes(a);

/** server: MeetingsApi.FollowUpRule — `title` fills {beschluss}, {mitglied}, {funktion}; `dueDays` null: no due date. */
export interface FollowUpRule {
  /** null until saved. */
  id: string | null;
  kind: Exclude<FollowUpKind, 'MANUAL'>;
  title: string;
  dueDays: number | null;
}

/** server: MeetingsApi.ActionRule — `majority`: fixed for the decision (statute change, dissolution), null: the resolution picks. */
export interface ActionRule {
  action: ResolutionAction;
  majority: Majority | null;
  followUps: FollowUpRule[];
}

/** Follow-up kinds that finish themselves, each only after its own decision (server: FollowUpPlanner.OWN_ACTION). */
export const OWN_ACTION: Partial<Record<FollowUpKind, ResolutionAction>> = {
  ENTER_HONORARY: 'HONORARY_GRANT', REVOKE_HONORARY: 'HONORARY_REVOKE', ENTER_OFFICE: 'ELECTION', NOTIFY_EXCLUSION: 'EXCLUSION',
  CONVENE_ASSEMBLY: 'CONVENE_ASSEMBLY',
};

export const FOLLOW_UP_KIND_LABELS: Readonly<Record<Exclude<FollowUpKind, 'MANUAL'>, string>> = {
  IMPLEMENT: 'Umsetzen',
  ENTER_HONORARY: 'Ehrenmitgliedschaft eintragen (erledigt sich selbst)',
  REVOKE_HONORARY: 'Ehrenmitgliedschaft aberkennen (erledigt sich selbst)',
  ENTER_OFFICE: 'Funktion eintragen (erledigt sich selbst)',
  NOTIFY_EXCLUSION: 'Ausschluss mitteilen',
  CONVENE_ASSEMBLY: 'Mitgliederversammlung einberufen (erledigt sich selbst)',
};

export type FollowUpKind = 'IMPLEMENT' | 'ENTER_HONORARY' | 'REVOKE_HONORARY' | 'ENTER_OFFICE' | 'NOTIFY_EXCLUSION' | 'CONVENE_ASSEMBLY' | 'MANUAL';

export interface FollowUp {
  id: string;
  resolutionId: string | null;
  kind: FollowUpKind;
  title: string;
  /** Finishes itself when its effect is entered (honorary membership, office, invitation). */
  automatic: boolean;
  dueAt: string | null;
  /** null while the task is being created. */
  taskId: string | null;
  taskStatus: 'OPEN' | 'IN_PROGRESS' | 'DONE' | null;
}

export interface NewFollowUp {
  title: string;
  description: string | null;
  /** Empty = the board. */
  assigneeIds: string[];
  dueAt: string | null;
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

/** server: MeetingRules.majorities — `null` = circular vote. */
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
export interface ResolutionRules {
  items: ActionRule[];
  circular: CircularRules;
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
}
