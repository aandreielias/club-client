import type { Reach } from '../../lib/reach';
import type { Hue } from '../../lib/types';

// Mirrors of the club-server calendar and attendance DTOs. API times are UTC instants.

/** Key of a club-defined appointment type (server: calendar_type); seeded TRAINING, MATCH, TOURNAMENT, MEETING, EVENT. */
export type AppointmentType = string;

/** server: CalendarApi.AppointmentTypeDto. */
export interface AppointmentTypeInfo {
  key: AppointmentType;
  label: string;
  hue: Hue;
  /** Car pools are offered. */
  rides: boolean;
  /** Changing cabins can be entered. */
  cabins: boolean;
  sort: number;
  archived: boolean;
  /** Appointments of this type exist: archive instead of deleting. */
  inUse: boolean;
  /** Members without an answer are reminded this many hours before the start; null: never. */
  remindHours: number | null;
  /** Opponent, home/away and sets. */
  hasResult: boolean;
  /** Heading of the plan block (e.g. "Trainingsinhalt"); null: none. */
  planLabel: string | null;
  /** New appointments start at this club time (HH:MM) … */
  defaultStart: string;
  /** … and last this long. */
  defaultMinutes: number;
  /** None lasts longer (1–30 days). */
  maxDays: number;
  /** Answers close this many hours before the start; 0: at the start. */
  answerDeadlineHours: number;
  /** "Vielleicht" is offered. */
  allowMaybe: boolean;
  /** "Nein" needs a reason. */
  reasonOnNo: boolean;
  /** Who answers: the team (club-wide: whoever likes), every member for club-wide ones, or nobody. */
  expectAnswers: ExpectAnswers;
  /** A new time or place is announced (and answers wait for confirmation). */
  notifyChanges: boolean;
  /** Time shifts up to this many minutes are not announced. */
  minShiftMinutes: number;
  /** Members (guardians for minors) mark their own presence while it runs. */
  selfCheckIn: boolean;
  /** A second reminder, fewer hours before the start than the first; null: none. */
  remindAgainHours: number | null;
}

export type ExpectAnswers = 'TEAM' | 'CLUB' | 'NONE';

export type AppointmentTypeInput = Omit<AppointmentTypeInfo, 'key' | 'inUse'>;

const RULES = {
  defaultStart: '18:00',
  defaultMinutes: 90,
  maxDays: 7,
  answerDeadlineHours: 0,
  allowMaybe: true,
  reasonOnNo: false,
  expectAnswers: 'TEAM',
  notifyChanges: true,
  minShiftMinutes: 0,
  selfCheckIn: false,
  remindAgainHours: null,
} as const;

/** server: V55__appointment_types.sql + V134__type_rules.sql + V137__type_notices.sql — the mock's seed and the tests' defaults. */
export const SEEDED_APPOINTMENT_TYPES: readonly AppointmentTypeInfo[] = [
  {
    key: 'TRAINING',
    label: 'Training',
    hue: 'blue',
    rides: false,
    cabins: true,
    sort: 1,
    archived: false,
    inUse: false,
    remindHours: null,
    hasResult: false,
    planLabel: 'Trainingsinhalt',
    ...RULES,
  },
  {
    key: 'MATCH',
    label: 'Spiel',
    hue: 'red',
    rides: true,
    cabins: true,
    sort: 2,
    archived: false,
    inUse: false,
    remindHours: 48,
    hasResult: true,
    planLabel: null,
    ...RULES,
  },
  {
    key: 'TOURNAMENT',
    label: 'Turnier',
    hue: 'purple',
    rides: true,
    cabins: true,
    sort: 3,
    archived: false,
    inUse: false,
    remindHours: 48,
    hasResult: true,
    planLabel: null,
    ...RULES,
  },
  {
    key: 'MEETING',
    label: 'Besprechung',
    hue: 'brown',
    rides: false,
    cabins: false,
    sort: 4,
    archived: false,
    inUse: false,
    remindHours: null,
    hasResult: false,
    planLabel: null,
    ...RULES,
  },
  {
    key: 'EVENT',
    label: 'Veranstaltung',
    hue: 'yellow',
    rides: true,
    cabins: true,
    sort: 5,
    archived: false,
    inUse: false,
    remindHours: null,
    hasResult: false,
    planLabel: null,
    ...RULES,
  },
];

export const HUES: readonly Hue[] = ['gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'red'];
export const HUE_LABELS: Readonly<Record<Hue, string>> = {
  gray: 'Grau',
  brown: 'Braun',
  orange: 'Orange',
  yellow: 'Gelb',
  green: 'Grün',
  blue: 'Blau',
  purple: 'Violett',
  red: 'Rot',
};

export type ResponseStatus = 'YES' | 'NO' | 'MAYBE';

export interface Appointment {
  id: string;
  /** Shared by every occurrence of a weekly series; null for single appointments. */
  seriesId: string | null;
  /** null = club-wide. */
  teamId: string | null;
  type: AppointmentType;
  title: string;
  description: string | null;
  /** Free text, or the name of the linked place. */
  location: string | null;
  /** A place of the locations module; null for free-text locations. */
  locationId: string | null;
  /** Changing cabins (free text) in the order of the club's cabin labels; '' = none for that label. */
  cabins: string[];
  startsAt: string;
  endsAt: string;
  cancelled: boolean;
  /** Car pools offered (set from the type when created, switched per appointment; the club switch comes on top). */
  rides: boolean;
  /** Why it was cancelled (only on a single appointment's read). */
  cancelReason?: string | null;
  /** Without team: `everyone` (Ganzer Verein) or the chosen people and groups (server: platform.Reach). Team appointments: empty. */
  audience: Reach;
  createdBy: string | null;
}

/** server: CalendarApi.CalendarSettings — club-wide calendar rules (Einstellungen › Kalender, admin/board). */
export interface CalendarSettings {
  /** 0–4 names of changing cabins (e.g. Herren, Damen); appointments carry one cabin per label. */
  cabinLabels: string[];
  /** Holders of needed items are reminded this long before the appointment (1–336). */
  itemRemindHours: number;
  /** "Offene Antworten" looks this many days ahead (7–60). */
  openAnswerDays: number;
  /** Most free seats one car pool may offer (1–50). */
  maxRideSeats: number;
}

export interface AppointmentList {
  items: Appointment[];
}

export interface NewAppointment {
  teamId: string | null;
  type: AppointmentType;
  title: string;
  description: string | null;
  location: string | null;
  locationId: string | null;
  cabins: string[];
  startsAt: string;
  endsAt: string;
  /** Club-local date of the last occurrence; null = single appointment. */
  repeatUntil: string | null;
  /** Every n weeks, or every n months (same date, or same nth weekday with byWeekday); not both. */
  intervalWeeks: number | null;
  intervalMonths: number | null;
  byWeekday: boolean;
  /** Omitted: what the type offers. */
  rides?: boolean;
  /** Without team: everyone or the chosen people and groups; omitted or empty = the whole club. Team appointments: none. */
  audience?: Reach;
}

/** Changes one occurrence; omitted fields stay unchanged, '' clears a text; clearLocationId unlinks the place. */
export type AppointmentPatch = Partial<
  Pick<Appointment, 'type' | 'title' | 'description' | 'location' | 'locationId' | 'cabins' | 'startsAt' | 'endsAt' | 'rides' | 'audience'>
> & { clearLocationId?: boolean; /** The later occurrences of the series change alike (times shift by as much). */ includeFollowing?: boolean };

export interface AttendanceEntry {
  memberId: string;
  name: string;
  /** null = not answered yet. */
  status: ResponseStatus | null;
  /** Only visible to coaches of the team, admin and board. */
  reason: string | null;
  updatedAt: string | null;
  /** An absence covers the day (no answer, or entered after a YES/MAYBE): counts as NO. */
  absent: boolean;
  /** Answered YES/MAYBE before the time changed; waits for a confirmation. */
  unconfirmed: boolean;
  /** Marked by the coach once it started; null: not marked (only for coaches, admin, board). */
  present: boolean | null;
}

/** server: AttendanceApi.OpenAnswer — still to answer, for oneself or a minor. */
export interface OpenAnswer {
  appointmentId: string;
  teamId: string | null;
  title: string;
  startsAt: string;
  memberId: string;
  name: string;
}

/** server: AttendanceApi.MemberStats — over a date range: held appointments, answers, presence marked by the coach. */
export interface MemberStats {
  memberId: string;
  name: string;
  appointments: number;
  yes: number;
  no: number;
  present: number;
  marked: number;
}

/** server: CalendarApi.Extras — training plan; match: opponent, home/away, sets ("25:20", ours first). */
export interface Extras {
  appointmentId: string;
  content: string | null;
  opponent: string | null;
  home: boolean | null;
  sets: string[];
  setsWon: number;
  setsLost: number;
  /** null while no sets are entered. */
  won: boolean | null;
}

export type ExtrasInput = Pick<Extras, 'content' | 'opponent' | 'home' | 'sets'>;

interface MatchResult {
  appointmentId: string;
  title: string;
  startsAt: string;
  opponent: string | null;
  home: boolean | null;
  sets: string[];
  setsWon: number;
  setsLost: number;
  won: boolean | null;
}

export interface MatchList {
  items: MatchResult[];
  won: number;
  lost: number;
}

/** "25:20" style, ours first (server: CalendarHandlers.SET). */
export const SET_PATTERN = /^\d{1,2}:\d{1,2}$/;

/** server: CalendarApi.HolidayDto — days the club does not train or play (club-local dates, both inclusive). */
export interface Holiday {
  id: string;
  name: string;
  from: string;
  to: string;
}

export interface TeamStats {
  teamId: string;
  from: string;
  to: string;
  appointments: number;
  items: MemberStats[];
}

export interface Attendance {
  appointmentId: string;
  yes: number;
  no: number;
  maybe: number;
  open: number;
  entries: AttendanceEntry[];
}

export interface AttendanceResponse {
  appointmentId: string;
  memberId: string;
  status: ResponseStatus;
  reason: string | null;
  updatedAt: string;
}

export interface FeedLink {
  url: string;
}

export const RESPONSE_OPTIONS: readonly { value: ResponseStatus; label: string }[] = [
  { value: 'YES', label: 'Zusage' },
  { value: 'MAYBE', label: 'Vielleicht' },
  { value: 'NO', label: 'Absage' },
];

const RESPONSE_HUES: Readonly<Record<ResponseStatus, Hue>> = { YES: 'green', MAYBE: 'yellow', NO: 'red' };

export const responseHue = (status: ResponseStatus | null): Hue => (status ? RESPONSE_HUES[status] : 'gray');

export const responseLabel = (status: ResponseStatus | null): string =>
  status ? (RESPONSE_OPTIONS.find((o) => o.value === status)?.label ?? status) : 'Offen';

/** A planned away period (club-local dates, both inclusive) of the member or one of their minors. */
export interface Absence {
  id: string;
  memberId: string;
  from: string;
  to: string;
  reason: string | null;
}

export interface AbsenceList {
  items: Absence[];
}

export interface NewAbsence {
  memberId: string | null;
  from: string;
  to: string;
  reason: string | null;
}

/** A car to an appointment (server: AttendanceApi.RideDto). */
export interface Ride {
  id: string;
  appointmentId: string;
  driverId: string;
  driverName: string;
  seats: number;
  note: string | null;
  passengers: { memberId: string; name: string }[];
}

export interface RideList {
  items: Ride[];
}
