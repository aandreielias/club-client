import type { Feature } from '../Feature';
import HomePage from './HomePage.svelte';

export const homeFeature: Feature = {
  id: 'home',
  routes: [{ path: '/', component: HomePage, nav: 'Start', icon: 'home' }],
};
