import { lazy } from '../../ui/lazy';
import { itemActions } from './actions';
import { PRIVILEGED } from '../../lib/types';
import { detailRoute, type Feature } from '../Feature';
import { INVENTORY_MESSAGES } from './messages';

const InventoryHome = lazy(() => import('./InventoryHome.svelte'));
const InventoryPage = lazy(() => import('./InventoryPage.svelte'));
const ItemCreateView = lazy(() => import('./ItemCreateView.svelte'));
const ItemView = lazy(() => import('./ItemView.svelte'));

export const inventoryFeature: Feature = {
  id: 'inventory',
  routes: [
    // server: InventoryHandlers.requireMaySee - admin, board and coaches only.
    { path: '/inventory', component: InventoryPage, nav: 'Inventar', icon: 'inventory', roles: PRIVILEGED },
    detailRoute('/inventory/:id', ItemView, { href: '/inventory', label: 'Inventar' }, { roles: PRIVILEGED }),
  ],
  actions: { item: itemActions },
  windows: {
    item: { label: 'Gegenstand', component: ItemView, page: (id) => `/inventory/${encodeURIComponent(id)}`, roles: PRIVILEGED },
    'item-new': { label: 'Neuer Gegenstand', component: ItemCreateView, roles: PRIVILEGED },
  },
  messages: INVENTORY_MESSAGES,
  home: { id: 'inventory', label: 'Inventar', component: InventoryHome, roles: PRIVILEGED },
};
