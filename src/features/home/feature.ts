import { lazy } from '../../ui/lazy';
import type { Feature } from '../Feature';

const AgendaHome = lazy(() => import('./AgendaHome.svelte'));
const HomePage = lazy(() => import('./HomePage.svelte'));
const SetupHome = lazy(() => import('./SetupHome.svelte'));

export const homeFeature: Feature = {
  id: 'home',
  routes: [{ path: '/', component: HomePage, nav: 'Start', icon: 'home' }],
  home: [
    // A new club's checklist, first on the page until the admin hides it.
    { id: 'setup', label: 'Einrichtung des Vereins', component: SetupHome, roles: ['ADMIN'], defaultShown: true },
    { id: 'agenda', label: 'Die nächsten Tage', component: AgendaHome, defaultShown: true },
  ],
};
