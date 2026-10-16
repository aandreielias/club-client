import { PRIVILEGED } from '../../lib/types';
import type { Feature } from '../Feature';
import ActivityHome from './ActivityHome.svelte';
import ActivityPage from './ActivityPage.svelte';

export const activityFeature: Feature = {
  id: 'activity',
  routes: [
    // server: ActivityHandlers.feed - admin and board all changes, coaches those of their teams.
    { path: '/activity', component: ActivityPage, nav: 'Logs', icon: 'activity', roles: PRIVILEGED },
  ],
  home: { id: 'activity', label: 'Logs', component: ActivityHome, roles: PRIVILEGED },
};
