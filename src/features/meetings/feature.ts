import { ADMIN_BOARD } from '../../lib/types';
import { detailRoute, type Feature } from '../Feature';
import { isAssembly } from './model';
import { meetingTypes, resolutionRules } from './services';
import MeetingCreateView from './MeetingCreateView.svelte';
import MeetingsPage from './MeetingsPage.svelte';
import MeetingsHome from './MeetingsHome.svelte';
import MeetingTypeCreateView from './MeetingTypeCreateView.svelte';
import MeetingTypeView from './MeetingTypeView.svelte';
import MeetingView from './MeetingView.svelte';
import CircularCreateView from './CircularCreateView.svelte';
import ResolutionView from './ResolutionView.svelte';
import ResolutionsPage from './ResolutionsPage.svelte';
import { MEETING_MESSAGES } from './messages';

export const meetingsFeature: Feature = {
  id: 'meetings',
  routes: [
    // Voters (extraordinary and honorary members) see general meetings, the board its own meetings too (server: MeetingAccess.maySee).
    { path: '/meetings', component: MeetingsPage, nav: 'Sitzungen', icon: 'meetings' },
    detailRoute('/meetings/:id', MeetingView, { href: '/meetings', label: 'Sitzungen' }),
    { path: '/resolutions', component: ResolutionsPage, nav: 'Beschlüsse', icon: 'resolutions' },
    detailRoute('/resolutions/:id', ResolutionView, { href: '/resolutions', label: 'Beschlüsse' }),
    detailRoute('/meeting-types/:key', MeetingTypeView, { href: '/settings/meeting-types', label: 'Sitzungsarten' }, { roles: ADMIN_BOARD }),
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
  },
  start: () => {
    const stops = [meetingTypes.start(), resolutionRules.start()];
    return () => stops.forEach((stop) => stop());
  },
  home: [{ id: 'meetings', label: 'Sitzungen', component: MeetingsHome }],
  messages: MEETING_MESSAGES,
  links: [
    { server: '/meetings/:id', to: ({ id }) => ({ window: { kind: 'meeting', id } }) },
    { server: '/resolutions/:id', to: ({ id }) => ({ window: { kind: 'resolution', id } }) },
  ],
};
