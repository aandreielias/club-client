import { ADMIN_BOARD } from '../../lib/types';
import type { Feature } from '../Feature';
import { isAssembly } from './model';
import { meetingTypes } from './services';
import DeadlinesPage from './DeadlinesPage.svelte';
import MeetingCreateView from './MeetingCreateView.svelte';
import MeetingPage from './MeetingPage.svelte';
import MeetingsPage from './MeetingsPage.svelte';
import MeetingsHome from './MeetingsHome.svelte';
import MeetingTypeCreateView from './MeetingTypeCreateView.svelte';
import MeetingTypePage from './MeetingTypePage.svelte';
import MeetingTypeView from './MeetingTypeView.svelte';
import DeadlinesHome from './DeadlinesHome.svelte';
import MeetingView from './MeetingView.svelte';
import CircularCreateView from './CircularCreateView.svelte';
import ResolutionPage from './ResolutionPage.svelte';
import ResolutionView from './ResolutionView.svelte';
import { MEETING_MESSAGES } from './messages';

export const meetingsFeature: Feature = {
  id: 'meetings',
  routes: [
    // Voters (extraordinary and honorary members) see general meetings, the board its own meetings too (server: MeetingAccess.maySee).
    { path: '/meetings', component: MeetingsPage, nav: 'Sitzungen', icon: 'meetings' },
    // Everything dated around the meetings as a list (the calendar's MEETING, DEADLINE, OFFICE and FOLLOW_UP items).
    { path: '/deadlines', component: DeadlinesPage, nav: 'Fristen', icon: 'alert', roles: ADMIN_BOARD },
    { path: '/meetings/:id', component: MeetingPage },
    { path: '/resolutions/:id', component: ResolutionPage },
    { path: '/meeting-types/:key', component: MeetingTypePage, roles: ADMIN_BOARD },
  ],
  windows: {
    meeting: { component: MeetingView, page: (id) => `/meetings/${encodeURIComponent(id)}` },
    'meeting-new': { component: MeetingCreateView, roles: ADMIN_BOARD },
    resolution: { component: ResolutionView, page: (id) => `/resolutions/${encodeURIComponent(id)}` },
    'resolution-new': { component: CircularCreateView, roles: ADMIN_BOARD },
    'meeting-type': { component: MeetingTypeView, page: (key) => `/meeting-types/${encodeURIComponent(key)}`, roles: ADMIN_BOARD },
    'meeting-type-new': { component: MeetingTypeCreateView, roles: ADMIN_BOARD },
  },
  calendar: {
    MEETING: (item) => {
      const assembly = isAssembly(meetingTypes.get(item.detail ?? ''));
      return { hue: assembly ? 'blue' : 'purple', label: assembly ? 'Mitgliederversammlung' : 'Vorstandssitzung' };
    },
    DEADLINE: (item) => ({ hue: item.kind === 'resolution' ? 'purple' : 'orange', label: item.kind === 'resolution' ? 'Umlaufbeschluss' : 'Einladungsfrist' }),
  },
  start: () => meetingTypes.start(),
  home: [
    { id: 'meetings', label: 'Sitzungen', component: MeetingsHome },
    { id: 'deadlines', label: 'Fristen', component: DeadlinesHome, roles: ADMIN_BOARD },
  ],
  messages: MEETING_MESSAGES,
  links: [
    { server: '/meetings/:id', to: ({ id }) => ({ window: { kind: 'meeting', id } }) },
    { server: '/resolutions/:id', to: ({ id }) => ({ window: { kind: 'resolution', id } }) },
  ],
};
