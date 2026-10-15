import type { Hue } from '../../lib/types';

// Mirrors of the club-server calendar and attendance DTOs. API times are UTC instants.

export type AppointmentType = 'TRAINING' | 'MATCH' | 'MEETING' | 'EVENT' | 'TOURNAMENT';

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
  location: string | null;
  startsAt: string;
  endsAt: string;
  cancelled: boolean;
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
  startsAt: string;
  endsAt: string;
  /** Club-local date of the last occurrence; null = single appointment. */
  repeatUntil: string | null;
  intervalWeeks: number | null;
}

/** Changes one occurrence; omitted fields stay unchanged. */
export type AppointmentPatch = Partial<Pick<Appointment, 'type' | 'title' | 'description' | 'location' | 'startsAt' | 'endsAt'>>;

export interface AttendanceEntry {
  memberId: string;
  name: string;
  /** null = not answered yet. */
  status: ResponseStatus | null;
  /** Only visible to coaches of the team, admin and board. */
  reason: string | null;
  updatedAt: string | null;
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

export const APPOINTMENT_TYPES: readonly { value: AppointmentType; label: string }[] = [
  { value: 'TRAINING', label: 'Training' },
  { value: 'MATCH', label: 'Spiel' },
  { value: 'TOURNAMENT', label: 'Turnier' },
  { value: 'MEETING', label: 'Besprechung' },
  { value: 'EVENT', label: 'Veranstaltung' },
];

export const RESPONSE_OPTIONS: readonly { value: ResponseStatus; label: string }[] = [
  { value: 'YES', label: 'Zusage' },
  { value: 'MAYBE', label: 'Vielleicht' },
  { value: 'NO', label: 'Absage' },
];

const TYPE_HUES: Readonly<Record<AppointmentType, Hue>> = {
  TRAINING: 'blue',
  MATCH: 'red',
  TOURNAMENT: 'purple',
  MEETING: 'brown',
  EVENT: 'yellow',
};

export const typeHue = (type: AppointmentType): Hue => TYPE_HUES[type];

const RESPONSE_HUES: Readonly<Record<ResponseStatus, Hue>> = { YES: 'green', MAYBE: 'yellow', NO: 'red' };

export const responseHue = (status: ResponseStatus | null): Hue => (status ? RESPONSE_HUES[status] : 'gray');

export const typeLabel = (type: AppointmentType): string => APPOINTMENT_TYPES.find((t) => t.value === type)?.label ?? type;

export const responseLabel = (status: ResponseStatus | null): string =>
  status ? (RESPONSE_OPTIONS.find((o) => o.value === status)?.label ?? status) : 'Offen';
