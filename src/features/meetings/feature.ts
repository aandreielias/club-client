import { ADMIN_BOARD } from '../../lib/types';
import type { Feature } from '../Feature';
import { MeetingCalendarSource } from './MeetingCalendarSource';
import MeetingCreateView from './MeetingCreateView.svelte';
import MeetingPage from './MeetingPage.svelte';
import MeetingsPage from './MeetingsPage.svelte';
import MeetingView from './MeetingView.svelte';
import { MEETING_MESSAGES } from './messages';
import { meetingsApi } from './services';

export const meetingsFeature: Feature = {
  id: 'meetings',
  routes: [
    // Club members see general meetings, the board its own meetings too (server: MeetingHandlers.maySee).
    { path: '/meetings', component: MeetingsPage, nav: 'Sitzungen', icon: 'meetings' },
    { path: '/meetings/:id', component: MeetingPage },
  ],
  windows: {
    meeting: { component: MeetingView, page: (id) => `/meetings/${encodeURIComponent(id)}` },
    'meeting-new': { component: MeetingCreateView, roles: ADMIN_BOARD },
  },
  calendar: new MeetingCalendarSource(meetingsApi),
  messages: MEETING_MESSAGES,
  links: [{ server: '/meetings/:id', to: ({ id }) => ({ window: { kind: 'meeting', id } }) }],
};
