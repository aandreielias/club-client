import type { ApiClient } from '../../lib/http/ApiClient';
import type { Item, ItemList, ItemPatch, NewItem } from './model';

/** Typed access to the inventory endpoints of club-server. */
export class InventoryApi {
  static readonly BASE = '/api/v1/inventory';

  constructor(private readonly api: ApiClient) {}

  /** Every item, ordered by name. */
  async list(): Promise<Item[]> {
    return (await this.api.get<ItemList>(InventoryApi.BASE)).items;
  }

  get(id: string): Promise<Item> {
    return this.api.get<Item>(this.path(id));
  }

  create(item: NewItem): Promise<Item> {
    return this.api.post<Item>(InventoryApi.BASE, item);
  }

  update(id: string, patch: ItemPatch): Promise<Item> {
    return this.api.patch<Item>(this.path(id), patch);
  }

  /** "Benötigt" lists keep the entry, marked as deleted. */
  delete(id: string): Promise<void> {
    return this.api.delete(this.path(id));
  }

  private path(id: string): string {
    return `${InventoryApi.BASE}/${encodeURIComponent(id)}`;
  }
}
