import { api, bus, permissions, session } from '../../lib/container';
import { AppointmentPolicy } from './AppointmentPolicy';
import { AppointmentTypesStore } from './AppointmentTypesStore.svelte';
import { CalendarApi } from './CalendarApi';
import { CalendarExport } from './CalendarExport';
import { settings } from '../../settings';

/** Calendar services, created once and shared by the calendar pages. */
export const calendarApi = new CalendarApi(api);
export const appointmentTypes = new AppointmentTypesStore(calendarApi, bus);
export const appointmentPolicy = new AppointmentPolicy(session, permissions);

export const calendarExport = new CalendarExport(calendarApi, settings.calendar, (type) => appointmentTypes.label(type));
