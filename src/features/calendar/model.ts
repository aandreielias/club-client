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
}

export type AppointmentTypeInput = Omit<AppointmentTypeInfo, 'key' | 'inUse'>;

/** server: V55__appointment_types.sql — shown until the club's types are loaded. */
export const SEEDED_APPOINTMENT_TYPES: readonly AppointmentTypeInfo[] = [
  { key: 'TRAINING', label: 'Training', hue: 'blue', rides: false, cabins: true, sort: 1, archived: false, inUse: false },
  { key: 'MATCH', label: 'Spiel', hue: 'red', rides: true, cabins: true, sort: 2, archived: false, inUse: false },
  { key: 'TOURNAMENT', label: 'Turnier', hue: 'purple', rides: true, cabins: true, sort: 3, archived: false, inUse: false },
  { key: 'MEETING', label: 'Besprechung', hue: 'brown', rides: false, cabins: false, sort: 4, archived: false, inUse: false },
  { key: 'EVENT', label: 'Veranstaltung', hue: 'yellow', rides: true, cabins: true, sort: 5, archived: false, inUse: false },
];

export const HUES: readonly Hue[] = ['gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'red'];

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
  /** Changing cabins (free text), not for meetings. */
  cabinMen: string | null;
  cabinWomen: string | null;
  startsAt: string;
  endsAt: string;
  cancelled: boolean;
  /** Car pools offered (set from the type when created, switched per appointment; the club switch comes on top). */
  rides: boolean;
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
  cabinMen: string | null;
  cabinWomen: string | null;
  startsAt: string;
  endsAt: string;
  /** Club-local date of the last occurrence; null = single appointment. */
  repeatUntil: string | null;
  intervalWeeks: number | null;
  /** Omitted: what the type offers. */
  rides?: boolean;
}

/** Changes one occurrence; omitted fields stay unchanged, '' clears a text; clearLocationId unlinks the place. */
export type AppointmentPatch = Partial<
  Pick<Appointment, 'type' | 'title' | 'description' | 'location' | 'locationId' | 'cabinMen' | 'cabinWomen' | 'startsAt' | 'endsAt' | 'rides'>
> & { clearLocationId?: boolean };

export interface AttendanceEntry {
  memberId: string;
  name: string;
  /** null = not answered yet. */
  status: ResponseStatus | null;
  /** Only visible to coaches of the team, admin and board. */
  reason: string | null;
  updatedAt: string | null;
  /** No answer, but an absence covers the day: counts as NO. */
  absent: boolean;
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
