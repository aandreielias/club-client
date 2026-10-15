// Live event types of the inventory module (server: InventoryApi.ItemChanged).

export const ITEM_CHANGED = 'inventory.item-changed';

export interface ItemChanged {
  itemId: string;
  change: 'CREATED' | 'UPDATED' | 'DELETED';
}
