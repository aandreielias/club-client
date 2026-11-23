import { lazy } from '../../ui/lazy';
import { locationActions } from './actions';
import { PRIVILEGED } from '../../lib/types';
import { detailRoute, type Feature } from '../Feature';
import { LOCATION_MESSAGES } from './messages';

const LocationCreateView = lazy(() => import('./LocationCreateView.svelte'));
const LocationsPage = lazy(() => import('./LocationsPage.svelte'));
const LocationView = lazy(() => import('./LocationView.svelte'));

export const locationsFeature: Feature = {
  id: 'locations',
  routes: [
    // server: LocationHandlers - every member reads the places.
    { path: '/locations', component: LocationsPage, nav: 'Orte', icon: 'location' },
    detailRoute('/locations/:id', LocationView, { href: '/locations', label: 'Orte' }),
  ],
  actions: { location: locationActions },
  windows: {
    location: { label: 'Ort', component: LocationView, page: (id) => `/locations/${encodeURIComponent(id)}` },
    'location-new': { label: 'Neuer Ort', component: LocationCreateView, roles: PRIVILEGED },
  },
  messages: LOCATION_MESSAGES,
};
