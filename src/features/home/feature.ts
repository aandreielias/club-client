import type { Feature } from '../Feature';
import AgendaHome from './AgendaHome.svelte';
import HomePage from './HomePage.svelte';

export const homeFeature: Feature = {
  id: 'home',
  routes: [{ path: '/', component: HomePage, nav: 'Start', icon: 'home' }],
  home: { id: 'agenda', label: 'Die nächsten Tage', component: AgendaHome, defaultShown: true },
};
