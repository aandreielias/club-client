import InventoryHome from './InventoryHome.svelte';
import { PRIVILEGED } from '../../lib/types';
import type { Feature } from '../Feature';
import InventoryPage from './InventoryPage.svelte';
import ItemCreateView from './ItemCreateView.svelte';
import ItemPage from './ItemPage.svelte';
import ItemView from './ItemView.svelte';
import { INVENTORY_MESSAGES } from './messages';

export const inventoryFeature: Feature = {
  id: 'inventory',
  routes: [
    // server: InventoryHandlers.requireMaySee - admin, board and coaches only.
    { path: '/inventory', component: InventoryPage, nav: 'Inventar', icon: 'inventory', roles: PRIVILEGED },
    { path: '/inventory/:id', component: ItemPage, roles: PRIVILEGED },
  ],
  windows: {
    item: { component: ItemView, page: (id) => `/inventory/${encodeURIComponent(id)}`, roles: PRIVILEGED },
    'item-new': { component: ItemCreateView, roles: PRIVILEGED },
  },
  messages: INVENTORY_MESSAGES,
  home: { id: 'inventory', label: 'Inventar', component: InventoryHome, roles: PRIVILEGED },
};
