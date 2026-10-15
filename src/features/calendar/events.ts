// Live event types of the calendar and attendance modules (server: ClientEvent records).

export const APPOINTMENTS_CHANGED = 'calendar.appointments-changed';
export const RESPONSE_CHANGED = 'attendance.response-changed';

export interface AppointmentsChanged {
  appointmentIds: string[];
  teamId: string | null;
  change: 'CREATED' | 'UPDATED' | 'CANCELLED';
  title: string;
  firstStartsAt: string;
}

export interface ResponseChanged {
  appointmentId: string;
  memberId: string;
  status: string;
}
