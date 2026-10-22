import { ADMIN_BOARD } from '../../lib/types';
import type { Feature } from '../Feature';
import { isAssembly, type MeetingKind } from './model';
import MeetingCreateView from './MeetingCreateView.svelte';
import MeetingPage from './MeetingPage.svelte';
import MeetingsPage from './MeetingsPage.svelte';
import MeetingView from './MeetingView.svelte';
import CircularCreateView from './CircularCreateView.svelte';
import ResolutionPage from './ResolutionPage.svelte';
import ResolutionView from './ResolutionView.svelte';
import { MEETING_MESSAGES } from './messages';

export const meetingsFeature: Feature = {
  id: 'meetings',
  routes: [
    // Club members see general meetings, the board its own meetings too (server: MeetingHandlers.maySee).
    { path: '/meetings', component: MeetingsPage, nav: 'Sitzungen', icon: 'meetings' },
    { path: '/meetings/:id', component: MeetingPage },
    { path: '/resolutions/:id', component: ResolutionPage },
  ],
  windows: {
    meeting: { component: MeetingView, page: (id) => `/meetings/${encodeURIComponent(id)}` },
    'meeting-new': { component: MeetingCreateView, roles: ADMIN_BOARD },
    resolution: { component: ResolutionView, page: (id) => `/resolutions/${encodeURIComponent(id)}` },
    'resolution-new': { component: CircularCreateView, roles: ADMIN_BOARD },
  },
  calendar: {
    MEETING: (item) => {
      const assembly = isAssembly(item.detail as MeetingKind);
      return { hue: assembly ? 'blue' : 'purple', label: assembly ? 'Mitgliederversammlung' : 'Vorstandssitzung' };
    },
    DEADLINE: (item) => ({ hue: item.kind === 'resolution' ? 'purple' : 'orange', label: item.kind === 'resolution' ? 'Umlaufbeschluss' : 'Einladungsfrist' }),
  },
  messages: MEETING_MESSAGES,
  links: [
    { server: '/meetings/:id', to: ({ id }) => ({ window: { kind: 'meeting', id } }) },
    { server: '/resolutions/:id', to: ({ id }) => ({ window: { kind: 'resolution', id } }) },
  ],
};
