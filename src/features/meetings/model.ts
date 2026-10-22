import type { LinkedRef } from '../../lib/records/refs';
import type { Hue } from '../../lib/types';
import type { OfficeKind } from '../members/MembersApi';

// Mirrors of the club-server meetings DTOs (statutes §8, §10). API times are UTC instants.

/** ASSEMBLY/EXTRA_ASSEMBLY: Mitgliederversammlung; the others: Vorstandssitzungen. */
export type MeetingKind = 'ASSEMBLY' | 'EXTRA_ASSEMBLY' | 'BOARD' | 'EXTRA_BOARD' | 'SIMPLE_BOARD' | 'CONSTITUENT_BOARD';
export type MeetingStatus = 'DRAFT' | 'INVITED' | 'OPEN' | 'CLOSED';
/** APP votes in the app; ANALOG is there without the app (in the room or on video). */
export type PresenceMode = 'APP' | 'ANALOG';

export const KIND_LABELS: Readonly<Record<MeetingKind, string>> = {
  ASSEMBLY: 'Ordentliche Mitgliederversammlung',
  EXTRA_ASSEMBLY: 'Außerordentliche Mitgliederversammlung',
  BOARD: 'Ordentliche Vorstandssitzung',
  EXTRA_BOARD: 'Außerordentliche Vorstandssitzung',
  SIMPLE_BOARD: 'Einfache Vorstandssitzung',
  CONSTITUENT_BOARD: 'Konstituierende Vorstandssitzung',
};

export const STATUS_LABELS: Readonly<Record<MeetingStatus, string>> = { DRAFT: 'Entwurf', INVITED: 'Eingeladen', OPEN: 'Läuft', CLOSED: 'Beendet' };
export const STATUS_TONES: Readonly<Record<MeetingStatus, Hue>> = { DRAFT: 'gray', INVITED: 'blue', OPEN: 'green', CLOSED: 'brown' };

export const isAssembly = (kind: MeetingKind): boolean => kind === 'ASSEMBLY' || kind === 'EXTRA_ASSEMBLY';

const HOUR = 3_600_000;
/** server: MeetingRules.notice — §8 Abs 4, §10 Abs 3, 6, 7. */
const NOTICE_MS: Readonly<Record<MeetingKind, number>> = {
  ASSEMBLY: 14 * 24 * HOUR,
  EXTRA_ASSEMBLY: 14 * 24 * HOUR,
  BOARD: 14 * 24 * HOUR,
  CONSTITUENT_BOARD: 14 * 24 * HOUR,
  SIMPLE_BOARD: 7 * 24 * HOUR,
  EXTRA_BOARD: 48 * HOUR,
};

/** server: MeetingRules.latestInvite — the last moment an invitation keeps the notice period. */
export const latestInvite = (kind: MeetingKind, startsAt: string): string => new Date(new Date(startsAt).getTime() - NOTICE_MS[kind]).toISOString();

/** The quorum rule in words, next to the presence list. */
export const QUORUM_TEXT: Readonly<Record<MeetingKind, string>> = {
  ASSEMBLY: 'mindestens die Hälfte; 30 Minuten nach Beginn unabhängig von der Anzahl',
  EXTRA_ASSEMBLY: 'mindestens die Hälfte; 30 Minuten nach Beginn unabhängig von der Anzahl',
  BOARD: 'mehr als die Hälfte',
  SIMPLE_BOARD: 'mehr als die Hälfte',
  CONSTITUENT_BOARD: 'mehr als die Hälfte',
  EXTRA_BOARD: 'mindestens drei Viertel',
};

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
  /** Reason of an extraordinary board meeting (§10 Abs 3). */
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

/** server: FollowUpPlanner.actions — `null` = circular vote. */
export function actions(kind: MeetingKind | null): ResolutionAction[] {
  switch (kind) {
    case null:
      return ['GENERAL', 'CONVENE_ASSEMBLY'];
    case 'ASSEMBLY':
      return ['GENERAL', 'ELECTION'];
    case 'EXTRA_ASSEMBLY':
      return ['GENERAL', 'ELECTION', 'HONORARY_GRANT', 'HONORARY_REVOKE', 'STATUTES_CHANGE', 'DISSOLUTION'];
    case 'EXTRA_BOARD':
      return ['GENERAL', 'EXCLUSION', 'CONVENE_ASSEMBLY'];
    default:
      return ['GENERAL', 'CONVENE_ASSEMBLY'];
  }
}

export const actionNeedsMember = (a: ResolutionAction): boolean => ['HONORARY_GRANT', 'HONORARY_REVOKE', 'ELECTION', 'EXCLUSION'].includes(a);

/** server: FollowUpPlanner.check — actions that fix the majority. */
export const IMPLIED_MAJORITY: Partial<Record<ResolutionAction, Majority>> = { STATUTES_CHANGE: 'TWO_THIRDS', DISSOLUTION: 'THREE_QUARTERS' };

export type FollowUpKind = 'IMPLEMENT' | 'ENTER_HONORARY' | 'REVOKE_HONORARY' | 'ENTER_OFFICE' | 'REPORT_AUTHORITY' | 'NOTIFY_EXCLUSION' | 'CONVENE_ASSEMBLY' | 'MANUAL';

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
export function majorities(kind: MeetingKind | null): Majority[] {
  if (kind === 'ASSEMBLY' || kind === 'EXTRA_ASSEMBLY') return ['SIMPLE', 'TWO_THIRDS', 'THREE_QUARTERS'];
  return kind === 'EXTRA_BOARD' ? ['THREE_QUARTERS'] : ['SIMPLE'];
}

/** server: Resolution.CIRCULAR_MIN (§10 Abs 15). */
export const CIRCULAR_MIN_MS = 3 * 24 * HOUR;

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
