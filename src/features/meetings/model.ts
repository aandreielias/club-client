import type { LinkedRef } from '../../lib/records/refs';
import type { Hue } from '../../lib/types';
import type { OfficeKind } from '../members/MembersApi';

// Mirrors of the club-server meetings DTOs. API times are UTC instants.

/** Key of a club-defined meeting type (server: meetings_type); seeded with ASSEMBLY, BOARD, … */
export type MeetingKind = string;
export type MeetingStatus = 'DRAFT' | 'INVITED' | 'OPEN' | 'CLOSED' | 'CANCELLED';
/** APP votes in the app; ANALOG is there without the app (in the room or on video). */
/** APP: votes in the app; ANALOG: votes through the minute taker; ONLINE: joins by video, votes in the app. */
export type PresenceMode = 'APP' | 'ANALOG' | 'ONLINE';

export const STATUS_LABELS: Readonly<Record<MeetingStatus, string>> = {
  DRAFT: 'Entwurf',
  INVITED: 'Eingeladen',
  OPEN: 'Läuft',
  CLOSED: 'Beendet',
  CANCELLED: 'Abgesagt',
};
export const STATUS_TONES: Readonly<Record<MeetingStatus, Hue>> = {
  DRAFT: 'gray',
  INVITED: 'blue',
  OPEN: 'green',
  CLOSED: 'brown',
  CANCELLED: 'red',
};

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
  /** States the reason of its urgency in the invitation. */
  needsReason: boolean;
  /** Held yearly, planned by this day ("MM-DD"). */
  dueBy: string | null;
  sort: number;
  archived: boolean;
  /** Members may join its meetings online; each shows its own link or the type's standing `videoUrl`. */
  online: boolean;
  videoUrl: string | null;
  /** Voters check themselves in while a meeting is open; off: who runs it enters presence. Missing on old data: on. */
  selfCheckIn?: boolean;
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
  /** Set once the protocol is final; until then it is written from the opening on, also after closing. */
  protocolFinalAt: string | null;
  /** The agenda as ordered items (the `agenda` text follows them). */
  agendaItems: AgendaItem[];
  /** Chair and secretary who approved the final protocol. */
  approvals: Approval[];
  latestInvite: string;
  /** Who votes and counts for the quorum. */
  electorate: Person[];
  present: Presence[];
  quorate: boolean;
  /** The viewer may edit, invite, take presence, open and close. */
  canManage: boolean;
  /** Linked records (files, members, appointments, ...) with the title they had when linked. */
  links: LinkedRef[];
}

export type MeetingSummary = Pick<Meeting, 'id' | 'kind' | 'title' | 'startsAt' | 'endsAt' | 'location' | 'status'>;

/**
 * server: MeetingsApi.MotionInput — what a Beschluss proposes: its text, the majority (null: the type's simple one), who carries it out
 * (empty: the board) and by when.
 */
export interface Motion {
  text: string | null;
  majority: Majority | null;
  assigneeIds: string[];
  implementDue: string | null;
}

/**
 * server: MeetingsApi.AgendaItemInput — an agenda item; with `motion` a Beschluss titled like the item (created, or its draft updated);
 * `resolutionId` without a motion keeps the item's resolution as it is; a left-out draft goes.
 */
export interface AgendaItemInput {
  id: string | null;
  title: string;
  note: string | null;
  resolutionId: string | null;
  motion: Motion | null;
}

export interface NewMeeting {
  kind: MeetingKind;
  title: string;
  /** The Tagesordnung, Beschlüsse among the items. */
  items: AgendaItemInput[];
  urgency: string | null;
  startsAt: string;
  endsAt: string;
  location: string | null;
  /** Its own link; empty: the type's standing one. */
  videoUrl: string | null;
}

/** server: MeetingsApi.AgendaItemDto — `resolutionId`: the motion voted on under this item. */
export interface AgendaItem {
  id: string | null;
  title: string;
  note: string | null;
  resolutionId: string | null;
}

export interface Approval {
  memberId: string;
  name: string;
  office: OfficeKind;
  at: string;
}

/** server: MeetingsApi.ResolutionSummary — one line of "Beschlüsse". */
export interface ResolutionSummary {
  id: string;
  meetingId: string | null;
  meetingTitle: string | null;
  title: string;
  status: 'DRAFT' | 'OPEN' | 'CLOSED';
  result: Result | null;
  openedAt: string | null;
  closedAt: string | null;
}

/** A draft Beschluss changes; omitted fields stay; `clearDue` removes the due date. */
export type ResolutionPatch = Partial<Omit<NewResolution, 'majority'>> & { majority?: Majority | null; clearDue?: boolean };

/** Omitted fields stay, '' clears a text. Times only before the invitation, the protocol from the opening until it is final. */
export type MeetingPatch = Partial<Omit<NewMeeting, 'kind' | 'items'>> & { protocol?: string };

// --- resolutions (server: MeetingsApi.ResolutionDto) ---

/** Of the valid votes (yes + no; abstentions don't count). */
export type Majority = 'SIMPLE' | 'TWO_THIRDS' | 'THREE_QUARTERS';
export type ResolutionStatus = 'DRAFT' | 'OPEN' | 'CLOSED';
export type Choice = 'YES' | 'NO' | 'ABSTAIN';
/** NOT_QUORATE: a circular vote in which no more than half of the board took part. */
export type Result = 'PASSED' | 'FAILED' | 'NOT_QUORATE';

export const MAJORITY_LABELS: Readonly<Record<Majority, string>> = {
  SIMPLE: 'Mehr als die Hälfte',
  TWO_THIRDS: 'Zwei Drittel',
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

/** server: MeetingsApi.ResolutionRules — how circular votes of the board run. */
export interface ResolutionRules {
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
  /** Who carries it out; empty = the board. */
  assignees: Person[];
  /** By when it is to be carried out (ISO date). */
  implementDue: string | null;
  /** Its task "umsetzen", once passed. */
  taskId: string | null;
  taskStatus: 'OPEN' | 'IN_PROGRESS' | 'DONE' | null;
  links: LinkedRef[];
}

export interface NewResolution {
  title: string;
  text: string | null;
  /** null: the meeting type's simple majority. */
  majority: Majority | null;
  /** Empty = the board. */
  assigneeIds: string[];
  implementDue: string | null;
}
