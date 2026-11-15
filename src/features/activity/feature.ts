import { ADMIN_BOARD, PRIVILEGED } from '../../lib/types';
import type { Feature } from '../Feature';
import ActivityHome from './ActivityHome.svelte';
import ActivityPage from './ActivityPage.svelte';

export const activityFeature: Feature = {
  id: 'activity',
  routes: [
    // Activity and access log; the feed (server: ActivityHandlers.feed) also reaches coaches, on the start page only.
    { path: '/activity', component: ActivityPage, nav: 'Protokolle', icon: 'activity', roles: ADMIN_BOARD },
  ],
  home: { id: 'activity', label: 'Aktivität', component: ActivityHome, roles: PRIVILEGED },
};
