import type { Feature } from '../Feature';
import AgendaHome from './AgendaHome.svelte';
import HomePage from './HomePage.svelte';
import SetupHome from './SetupHome.svelte';

export const homeFeature: Feature = {
  id: 'home',
  routes: [{ path: '/', component: HomePage, nav: 'Start', icon: 'home' }],
  home: [
    // A new club's checklist, first on the page until the admin hides it.
    { id: 'setup', label: 'Einrichtung des Vereins', component: SetupHome, roles: ['ADMIN'], defaultShown: true },
    { id: 'agenda', label: 'Die nächsten Tage', component: AgendaHome, defaultShown: true },
  ],
};
