import CalendarHome from './CalendarHome.svelte';
import OpenAnswersHome from './OpenAnswersHome.svelte';
import { permissions } from '../../lib/container';
import { ADMIN_BOARD } from '../../lib/types';
import { detailRoute, type Feature } from '../Feature';
import { appointmentTypes } from './services';
import AppointmentCreateView from './AppointmentCreateView.svelte';
import AppointmentView from './AppointmentView.svelte';
import AppointmentTypeCreateView from './AppointmentTypeCreateView.svelte';
import AppointmentTypeView from './AppointmentTypeView.svelte';
import CalendarPage from './CalendarPage.svelte';
import EventsPage from './EventsPage.svelte';
import AbsenceCreateView from './AbsenceCreateView.svelte';
import AbsencesPage from './AbsencesPage.svelte';
import HolidayCreateView from './HolidayCreateView.svelte';
import HolidayView from './HolidayView.svelte';
import { CALENDAR_MESSAGES } from './messages';

export const calendarFeature: Feature = {
  id: 'calendar',
  routes: [
    { path: '/calendar', component: CalendarPage, nav: 'Kalender', icon: 'calendar' },
    { path: '/events', component: EventsPage, nav: 'Events', icon: 'events' },
    { path: '/calendar/absences', component: AbsencesPage },
    detailRoute('/calendar/:id', AppointmentView, { href: '/calendar', label: 'Kalender' }),
    detailRoute(
      '/appointment-types/:key',
      AppointmentTypeView,
      { href: '/settings/appointment-types', label: 'Terminarten' },
      { roles: ADMIN_BOARD },
    ),
    detailRoute('/holidays/:id', HolidayView, { href: '/settings/holidays', label: 'Feiertage' }, { roles: ADMIN_BOARD }),
  ],
  windows: {
    appointment: { component: AppointmentView, page: (id) => `/calendar/${encodeURIComponent(id)}` },
    // Admin/board, and coaches of a team (by team role, server: requireMayEdit).
    'appointment-new': { component: AppointmentCreateView, canOpen: () => permissions.canManageAnything() },
    'appointment-type': { component: AppointmentTypeView, page: (key) => `/appointment-types/${encodeURIComponent(key)}`, roles: ADMIN_BOARD },
    'appointment-type-new': { component: AppointmentTypeCreateView, roles: ADMIN_BOARD },
    holiday: { component: HolidayView, page: (id) => `/holidays/${encodeURIComponent(id)}`, roles: ADMIN_BOARD },
    'holiday-new': { component: HolidayCreateView, roles: ADMIN_BOARD },
    'absence-new': { component: AbsenceCreateView },
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
  home: [
    { id: 'open-answers', label: 'Offene Zusagen', component: OpenAnswersHome, defaultShown: true },
    { id: 'calendar', label: 'Termine', component: CalendarHome },
  ],
  links: [{ server: '/appointments/:id', to: ({ id }) => ({ window: { kind: 'appointment', id } }) }],
};
