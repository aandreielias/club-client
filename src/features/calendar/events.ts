// Live event types of the calendar and attendance modules (server: ClientEvent records).

import { defineEvent } from '../../lib/bus';
import { liveEvent } from '../../lib/live/LiveUpdates.svelte';

/** An absence was entered in this browser (the server pushes no event for it); the list reloads. */
export const ABSENCES_CHANGED = defineEvent('calendar/absences-changed');

export const APPOINTMENTS_CHANGED = liveEvent<AppointmentsChanged>('calendar.appointments-changed');
export const RIDES_CHANGED = liveEvent<RidesChanged>('attendance.rides-changed');
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

export interface RidesChanged {
  appointmentId: string;
}
