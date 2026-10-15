import { api, session } from '../../lib/container';
import { InventoryApi } from './InventoryApi';
import { InventoryPolicy } from './InventoryPolicy';

/** Inventory services, created once and shared by the inventory views. */
export const inventoryApi = new InventoryApi(api);
export const inventoryPolicy = new InventoryPolicy(session);
