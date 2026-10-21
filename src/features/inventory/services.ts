import { api } from '../../lib/container';
import { InventoryApi } from './InventoryApi';

/** Inventory services, created once and shared by the inventory views. */
export const inventoryApi = new InventoryApi(api);
