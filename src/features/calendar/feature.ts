import CalendarHome from './CalendarHome.svelte';
import { ADMIN_BOARD, PRIVILEGED } from '../../lib/types';
import type { Feature } from '../Feature';
import { appointmentTypes } from './services';
import AppointmentCreateView from './AppointmentCreateView.svelte';
import AppointmentPage from './AppointmentPage.svelte';
import AppointmentView from './AppointmentView.svelte';
import AppointmentTypeCreateView from './AppointmentTypeCreateView.svelte';
import AppointmentTypePage from './AppointmentTypePage.svelte';
import AppointmentTypeView from './AppointmentTypeView.svelte';
import CalendarPage from './CalendarPage.svelte';
import EventsPage from './EventsPage.svelte';
import AbsencesPage from './AbsencesPage.svelte';
import { CALENDAR_MESSAGES } from './messages';

export const calendarFeature: Feature = {
  id: 'calendar',
  routes: [
    { path: '/calendar', component: CalendarPage, nav: 'Kalender', icon: 'calendar' },
    { path: '/events', component: EventsPage, nav: 'Events', icon: 'events' },
    { path: '/calendar/absences', component: AbsencesPage },
    { path: '/calendar/:id', component: AppointmentPage },
    { path: '/appointment-types/:key', component: AppointmentTypePage, roles: ADMIN_BOARD },
  ],
  windows: {
    appointment: { component: AppointmentView, page: (id) => `/calendar/${encodeURIComponent(id)}` },
    'appointment-new': { component: AppointmentCreateView, roles: PRIVILEGED },
    'appointment-type': { component: AppointmentTypeView, page: (key) => `/appointment-types/${encodeURIComponent(key)}`, roles: ADMIN_BOARD },
    'appointment-type-new': { component: AppointmentTypeCreateView, roles: ADMIN_BOARD },
  },
  start: () => appointmentTypes.start(),
  calendar: {
    // The reason comes only for who may see it (self, guardians, coaches, admin, board).
    ABSENCE: (item) => ({ title: item.detail ? `${item.title} – ${item.detail}` : item.title, label: 'Abwesend' }),
    APPOINTMENT: (item) => ({
      hue: appointmentTypes.hue(item.detail ?? ''),
      label: item.inactive ? 'Abgesagt' : appointmentTypes.label(item.detail ?? ''),
    }),
  },
  messages: CALENDAR_MESSAGES,
  home: { id: 'calendar', label: 'Termine', component: CalendarHome },
  links: [{ server: '/appointments/:id', to: ({ id }) => ({ window: { kind: 'appointment', id } }) }],
};
