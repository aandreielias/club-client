import { PRIVILEGED } from '../../lib/types';
import type { Feature } from '../Feature';
import { AppointmentCalendarSource } from './AppointmentCalendarSource';
import AppointmentCreateView from './AppointmentCreateView.svelte';
import AppointmentPage from './AppointmentPage.svelte';
import AppointmentView from './AppointmentView.svelte';
import CalendarPage from './CalendarPage.svelte';
import { CALENDAR_MESSAGES } from './messages';
import { calendarApi } from './services';

export const calendarFeature: Feature = {
  id: 'calendar',
  routes: [
    { path: '/calendar', component: CalendarPage, nav: 'Kalender', icon: 'calendar' },
    { path: '/calendar/:id', component: AppointmentPage },
  ],
  windows: {
    appointment: { component: AppointmentView, page: (id) => `/calendar/${encodeURIComponent(id)}` },
    'appointment-new': { component: AppointmentCreateView, roles: PRIVILEGED },
  },
  calendar: new AppointmentCalendarSource(calendarApi),
  messages: CALENDAR_MESSAGES,
  links: [{ server: '/appointments/:id', to: ({ id }) => ({ window: { kind: 'appointment', id } }) }],
};
