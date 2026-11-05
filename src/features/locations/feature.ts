import { PRIVILEGED } from '../../lib/types';
import { detailRoute, type Feature } from '../Feature';
import LocationCreateView from './LocationCreateView.svelte';
import LocationsPage from './LocationsPage.svelte';
import LocationView from './LocationView.svelte';
import { LOCATION_MESSAGES } from './messages';

export const locationsFeature: Feature = {
  id: 'locations',
  routes: [
    // server: LocationHandlers - every member reads the places.
    { path: '/locations', component: LocationsPage, nav: 'Orte', icon: 'location' },
    detailRoute('/locations/:id', LocationView, { href: '/locations', label: 'Orte' }),
  ],
  windows: {
    location: { component: LocationView, page: (id) => `/locations/${encodeURIComponent(id)}` },
    'location-new': { component: LocationCreateView, roles: PRIVILEGED },
  },
  messages: LOCATION_MESSAGES,
};
