// Live event types of the calendar and attendance modules (server: ClientEvent records).

import { liveEvent } from '../../lib/live/LiveUpdates.svelte';

export const APPOINTMENTS_CHANGED = liveEvent<AppointmentsChanged>('calendar.appointments-changed');
export const RESPONSE_CHANGED = liveEvent<ResponseChanged>('attendance.response-changed');

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
