import type { Feature } from '../Feature';
import InventoryPage from './InventoryPage.svelte';
import ItemCreateView from './ItemCreateView.svelte';
import ItemPage from './ItemPage.svelte';
import ItemView from './ItemView.svelte';
import { INVENTORY_MESSAGES } from './messages';

export const inventoryFeature: Feature = {
  id: 'inventory',
  routes: [
    { path: '/inventory', component: InventoryPage, nav: 'Inventar', icon: 'inventory' },
    { path: '/inventory/:id', component: ItemPage },
  ],
  windows: {
    item: { component: ItemView, page: (id) => `/inventory/${encodeURIComponent(id)}` },
    'item-new': { component: ItemCreateView },
  },
  messages: INVENTORY_MESSAGES,
};
