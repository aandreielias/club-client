import type { ApiClient } from '../../lib/http/ApiClient';
import type { Item, ItemList, ItemPatch, ItemUse, NewItem, OwnItem, StockInput } from './model';

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

  /** Upcoming appointments and open tasks the member sees that need the item. */
  async uses(id: string): Promise<ItemUse[]> {
    return (await this.api.get<{ uses: ItemUse[] }>(`${this.path(id)}/uses`)).uses;
  }

  create(item: NewItem): Promise<Item> {
    return this.api.post<Item>(InventoryApi.BASE, item);
  }

  update(id: string, patch: ItemPatch): Promise<Item> {
    return this.api.patch<Item>(this.path(id), patch);
  }

  /** Replaces where the items are; the quantity becomes the sum. */
  setStock(id: string, entries: readonly StockInput[]): Promise<Item> {
    return this.api.put<Item>(`${this.path(id)}/stock`, { entries });
  }

  /** What a member holds (admin, board, coaches, the member and their guardians). */
  async heldBy(memberId: string): Promise<OwnItem[]> {
    return (await this.api.get<{ items: OwnItem[] }>(`${InventoryApi.BASE}/held/${encodeURIComponent(memberId)}`)).items;
  }

  /** What the signed-in member holds; every member may ask. */
  async mine(): Promise<OwnItem[]> {
    return (await this.api.get<{ items: OwnItem[] }>(`${InventoryApi.BASE}/mine`)).items;
  }

  /** "Benötigt" lists keep the entry, marked as deleted. */
  delete(id: string): Promise<void> {
    return this.api.delete(this.path(id));
  }

  private path(id: string): string {
    return `${InventoryApi.BASE}/${encodeURIComponent(id)}`;
  }
}
