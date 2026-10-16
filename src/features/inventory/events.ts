// Live event types of the inventory module (server: InventoryApi.ItemChanged).

import { liveEvent } from '../../lib/live/LiveUpdates.svelte';

export const ITEM_CHANGED = liveEvent<ItemChanged>('inventory.item-changed');

export interface ItemChanged {
  itemId: string;
  change: 'CREATED' | 'UPDATED' | 'DELETED';
}
