import { api, permissions, session } from '../../lib/container';
import { AppointmentPolicy } from './AppointmentPolicy';
import { CalendarApi } from './CalendarApi';

/** Calendar services, created once and shared by the calendar pages. */
export const calendarApi = new CalendarApi(api);
export const appointmentPolicy = new AppointmentPolicy(session, permissions);
