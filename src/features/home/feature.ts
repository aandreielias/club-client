import type { Feature } from '../Feature';
import AgendaSection from './AgendaSection.svelte';
import HomePage from './HomePage.svelte';

export const homeFeature: Feature = {
  id: 'home',
  routes: [{ path: '/', component: HomePage, nav: 'Start', icon: 'home' }],
  home: { id: 'agenda', label: 'Die nächsten Tage', component: AgendaSection },
};
