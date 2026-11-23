import { lazy } from '../../ui/lazy';
import { appointmentActions, appointmentTypeActions, holidayActions } from './actions';
import { bus, permissions } from '../../lib/container';
import { LIVE_RESYNC } from '../../lib/live/LiveUpdates.svelte';
import { CALENDAR_SETTINGS_CHANGED } from './events';
import { ADMIN_BOARD } from '../../lib/types';
import { detailRoute, type Feature } from '../Feature';
import { appointmentTypes, calendarSettings } from './services';
import { CALENDAR_MESSAGES } from './messages';

const CalendarHome = lazy(() => import('./CalendarHome.svelte'));
const OpenAnswersHome = lazy(() => import('./OpenAnswersHome.svelte'));
const AppointmentCreateView = lazy(() => import('./AppointmentCreateView.svelte'));
const AppointmentView = lazy(() => import('./AppointmentView.svelte'));
const AppointmentTypeCreateView = lazy(() => import('./AppointmentTypeCreateView.svelte'));
const AppointmentTypeView = lazy(() => import('./AppointmentTypeView.svelte'));
const CalendarPage = lazy(() => import('./CalendarPage.svelte'));
const EventsPage = lazy(() => import('./EventsPage.svelte'));
const AbsenceCreateView = lazy(() => import('./AbsenceCreateView.svelte'));
const AbsencesPage = lazy(() => import('./AbsencesPage.svelte'));
const HolidayCreateView = lazy(() => import('./HolidayCreateView.svelte'));
const HolidayView = lazy(() => import('./HolidayView.svelte'));

export const calendarFeature: Feature = {
  id: 'calendar',
  routes: [
    { path: '/calendar', component: CalendarPage, nav: 'Kalender', icon: 'calendar' },
    { path: '/events', component: EventsPage, nav: 'Termine', icon: 'events' },
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
    appointment: { label: 'Termin', component: AppointmentView, page: (id) => `/calendar/${encodeURIComponent(id)}` },
    // Admin/board, and coaches of a team (by team role, server: requireMayEdit).
    'appointment-new': { label: 'Neuer Termin', component: AppointmentCreateView, canOpen: () => permissions.canManageAnything() },
    'appointment-type': {
      label: 'Terminart',
      component: AppointmentTypeView,
      page: (key) => `/appointment-types/${encodeURIComponent(key)}`,
      roles: ADMIN_BOARD,
    },
    'appointment-type-new': { label: 'Neue Terminart', component: AppointmentTypeCreateView, roles: ADMIN_BOARD },
    holiday: { label: 'Feiertag', component: HolidayView, page: (id) => `/holidays/${encodeURIComponent(id)}`, roles: ADMIN_BOARD },
    'holiday-new': { label: 'Neuer Feiertag', component: HolidayCreateView, roles: ADMIN_BOARD },
    'absence-new': { label: 'Neue Abwesenheit', component: AbsenceCreateView },
  },
  actions: { appointment: appointmentActions, 'appointment-type': appointmentTypeActions, holiday: holidayActions },
  start: (guest) => {
    if (guest) return undefined;
    const reload = () => void calendarSettings.load();
    reload();
    const subscriptions = [bus.subscribe(CALENDAR_SETTINGS_CHANGED, reload), bus.subscribe(LIVE_RESYNC, reload)];
    const stopTypes = appointmentTypes.start();
    return () => {
      subscriptions.forEach((s) => s.unsubscribe());
      stopTypes();
    };
  },
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
