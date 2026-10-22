import CalendarHome from './CalendarHome.svelte';
import { PRIVILEGED } from '../../lib/types';
import type { Feature } from '../Feature';
import { typeHue, typeLabel, type AppointmentType } from './model';
import AppointmentCreateView from './AppointmentCreateView.svelte';
import AppointmentPage from './AppointmentPage.svelte';
import AppointmentView from './AppointmentView.svelte';
import CalendarPage from './CalendarPage.svelte';
import EventsPage from './EventsPage.svelte';
import AbsencesPage from './AbsencesPage.svelte';
import { CALENDAR_MESSAGES } from './messages';
import { calendarApi } from './services';

export const calendarFeature: Feature = {
  id: 'calendar',
  routes: [
    { path: '/calendar', component: CalendarPage, nav: 'Kalender', icon: 'calendar' },
    { path: '/events', component: EventsPage, nav: 'Events', icon: 'events' },
    { path: '/calendar/absences', component: AbsencesPage },
    { path: '/calendar/:id', component: AppointmentPage },
  ],
  windows: {
    appointment: { component: AppointmentView, page: (id) => `/calendar/${encodeURIComponent(id)}` },
    'appointment-new': { component: AppointmentCreateView, roles: PRIVILEGED },
  },
  calendar: {
    APPOINTMENT: (item) => ({ hue: typeHue(item.detail as AppointmentType), label: item.inactive ? 'Abgesagt' : typeLabel(item.detail as AppointmentType) }),
  },
  messages: CALENDAR_MESSAGES,
  home: { id: 'calendar', label: 'Termine', component: CalendarHome },
  links: [{ server: '/appointments/:id', to: ({ id }) => ({ window: { kind: 'appointment', id } }) }],
};
