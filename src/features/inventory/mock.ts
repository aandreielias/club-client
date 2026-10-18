// Mock of the club-server inventory module (InventoryHandlers): everyone reads, admin/board/coaches manage.
import { settings } from '../../settings';
import { directory, type MockDirectory } from '../../lib/mock/core';
import { itemUseSources, linkRefs } from '../../lib/mock/MockLinks';
import { MockServer, mockServer, type MockRequest } from '../../lib/mock/MockServer';
import { MockTable } from '../../lib/mock/MockTable';
import { PRIVILEGED, type Member } from '../../lib/types';
import type { Item, ItemPatch, NewItem, OwnItem, StockInput, StockPlace } from './model';
import { locations, MockLocations } from '../locations/mock';

const fail = MockServer.fail;
const limits = settings.inventory;

type StoredItem = Omit<Item, 'stock'>;

export class MockInventory {
  readonly items: MockTable<StoredItem[]>;
  /** itemId → stock lines (server: inventory_stock) */
  readonly stock: MockTable<Record<string, StockInput[]>>;

  constructor(private readonly people: MockDirectory) {
    this.items = new MockTable('inventory', () => MockInventory.seed());
    this.stock = new MockTable('inventory-stock', () => MockInventory.seedStock());
    this.upgradeStored();
    mockServer.events.subscribe((event) => event.type === 'locations.location-changed' && this.onLocationChanged(event.data as never));
  }

  list(): Item[] {
    return [...this.items.data].sort((a, b) => a.name.localeCompare(b.name, 'de')).map((i) => this.dto(i));
  }

  get(id: string): Item {
    return this.dto(this.find(id));
  }

  create(member: Member, body: Partial<NewItem>): Item {
    this.people.requirePrivileged(member, PRIVILEGED);
    const now = new Date().toISOString();
    const item = MockInventory.validated({
      id: crypto.randomUUID(),
      name: body.name ?? '',
      category: body.category ?? null,
      quantity: body.quantity ?? 0,
      description: body.description ?? null,
      createdAt: now,
      updatedAt: now,
    });
    const lines = item.quantity ? [{ locationId: body.locationId ?? null, holderId: null, quantity: item.quantity }] : [];
    this.requireKnownPlaces(lines);
    this.items.data.push(item);
    this.stock.data[item.id] = lines;
    this.items.save();
    this.stock.save();
    this.changed(item.id, 'CREATED');
    return this.dto(item);
  }

  /** Null fields stay unchanged; an empty text clears it. The quantity follows the stock. */
  update(member: Member, id: string, patch: ItemPatch): Item {
    this.people.requirePrivileged(member, PRIVILEGED);
    const current = this.find(id);
    const next = MockInventory.validated({
      ...current,
      name: patch.name ?? current.name,
      category: patch.category ?? current.category,
      description: patch.description ?? current.description,
      updatedAt: new Date().toISOString(),
    });
    Object.assign(current, next);
    this.items.save();
    this.changed(id, 'UPDATED');
    return this.dto(current);
  }

  /**
   * Items a browser stored before stock existed (server: migration V27): the free-text place becomes a place
   * of the locations module, the whole quantity sits there.
   */
  private upgradeStored(): void {
    const old = this.items.data.filter((i) => !this.stock.data[i.id]) as (StoredItem & { location?: string | null })[];
    if (!old.length) return;
    for (const item of old) {
      const name = item.location?.trim();
      let place = name ? locations.list().find((l) => l.name.toLowerCase() === name.toLowerCase()) : undefined;
      if (name && !place) {
        const now = new Date().toISOString();
        const stored = { id: crypto.randomUUID(), name, street: null, zip: null, city: null, note: null, lat: null, lng: null, createdAt: now, updatedAt: now };
        locations.locations.data.push(stored);
        place = MockLocations.dto(stored);
      }
      this.stock.data[item.id] = item.quantity ? [{ locationId: place?.id ?? null, holderId: null, quantity: item.quantity }] : [];
      delete item.location;
    }
    locations.locations.save();
    this.items.save();
    this.stock.save();
  }

  /** server: InventoryHandlers.setStock - the same place twice is merged, the sum becomes the quantity. */
  setStock(member: Member, id: string, entries: unknown): Item {
    this.people.requirePrivileged(member, PRIVILEGED);
    if (!Array.isArray(entries) || entries.length > limits.maxStockLines) return fail(400, 'inventory.stock-invalid');
    const merged: StockInput[] = [];
    for (const e of entries as StockInput[]) {
      if (e.locationId && e.holderId) fail(400, 'inventory.stock-invalid');
      if (!Number.isInteger(e.quantity) || e.quantity < 1 || e.quantity > limits.maxQuantity) fail(400, 'inventory.quantity-invalid');
      const same = merged.find((m) => m.locationId === (e.locationId ?? null) && m.holderId === (e.holderId ?? null));
      if (same) same.quantity += e.quantity;
      else merged.push({ locationId: e.locationId ?? null, holderId: e.holderId ?? null, quantity: e.quantity });
    }
    const total = merged.reduce((sum, e) => sum + e.quantity, 0);
    if (total > limits.maxQuantity) fail(400, 'inventory.quantity-invalid');
    this.requireKnownPlaces(merged);
    const item = this.find(id);
    Object.assign(item, { quantity: total, updatedAt: new Date().toISOString() });
    this.stock.data[id] = merged;
    this.items.save();
    this.stock.save();
    this.changed(id, 'UPDATED');
    return this.dto(item);
  }

  /** server: InventoryHandlers.own */
  mine(member: Member): { items: OwnItem[] } {
    const held = this.holdings(this.items.data.map((i) => i.id));
    return {
      items: this.items.data
        .filter((i) => held[i.id]?.[member.id])
        .map((i) => ({ itemId: i.id, name: i.name, quantity: held[i.id][member.id] }))
        .sort((a, b) => a.name.localeCompare(b.name, 'de')),
    };
  }

  /** server: InventoryApi.HOLDINGS - item → holder → quantity */
  holdings(itemIds: readonly string[]): Record<string, Record<string, number>> {
    const result: Record<string, Record<string, number>> = {};
    for (const id of itemIds) {
      for (const line of this.stock.data[id] ?? []) {
        if (line.holderId) (result[id] ??= {})[line.holderId] = (result[id]?.[line.holderId] ?? 0) + line.quantity;
      }
    }
    return result;
  }

  delete(member: Member, id: string): void {
    this.people.requirePrivileged(member, PRIVILEGED);
    const item = this.find(id);
    this.items.data.splice(this.items.data.indexOf(item), 1);
    delete this.stock.data[id];
    this.items.save();
    this.stock.save();
    this.changed(id, 'DELETED');
  }

  /** Stock with the names of places and people (server: InventoryHandlers.places). */
  places(itemId: string): StockPlace[] {
    return (this.stock.data[itemId] ?? []).map((line): StockPlace =>
      line.locationId
        ? { kind: 'LOCATION', id: line.locationId, name: locations.ref(line.locationId)?.name ?? null, quantity: line.quantity }
        : line.holderId
          ? { kind: 'PERSON', id: line.holderId, name: this.people.name(line.holderId), quantity: line.quantity }
          : { kind: 'NONE', id: null, name: null, quantity: line.quantity },
    );
  }

  /** server: InventoryHandlers.onLocationChanged - a deleted place's stock becomes "ohne Ort". */
  private onLocationChanged(data: { locationId: string; change: string }): void {
    if (data.change !== 'DELETED') return;
    for (const [itemId, lines] of Object.entries(this.stock.data)) {
      if (!lines.some((l) => l.locationId === data.locationId)) continue;
      const moved: StockInput[] = [];
      for (const line of lines) {
        const next = line.locationId === data.locationId ? { ...line, locationId: null } : line;
        const same = moved.find((m) => m.locationId === next.locationId && m.holderId === next.holderId);
        if (same) same.quantity += next.quantity;
        else moved.push({ ...next });
      }
      this.stock.data[itemId] = moved;
      this.changed(itemId, 'UPDATED');
    }
    this.stock.save();
  }

  private requireKnownPlaces(lines: readonly StockInput[]): void {
    if (lines.some((l) => l.locationId && !locations.ref(l.locationId))) fail(400, 'inventory.location-unknown');
    if (lines.some((l) => l.holderId && !this.people.activeIds().includes(l.holderId))) fail(400, 'inventory.holder-unknown');
  }

  private dto(item: StoredItem): Item {
    return { ...item, stock: this.places(item.id) };
  }

  private find(id: string): StoredItem {
    return this.items.data.find((i) => i.id === id) ?? fail(404, 'inventory.not-found');
  }

  private changed(itemId: string, change: string): void {
    mockServer.events.publish({ type: 'inventory.item-changed', data: { itemId, change }, audience: { roles: PRIVILEGED } });
  }

  /** server: Item constructor checks */
  private static validated(item: StoredItem): StoredItem {
    const text = (value: string | null, max: number, code: string) => {
      const trimmed = value?.trim() ?? '';
      if (trimmed.length > max) fail(400, code);
      return trimmed || null;
    };
    const name = item.name?.trim() ?? '';
    if (!name || name.length > limits.nameMaxLength) fail(400, 'inventory.name-invalid');
    if (!Number.isInteger(item.quantity) || item.quantity < 0 || item.quantity > limits.maxQuantity) fail(400, 'inventory.quantity-invalid');
    return {
      ...item,
      name,
      category: text(item.category, limits.categoryMaxLength, 'inventory.category-invalid'),
      description: text(item.description, limits.descriptionMaxLength, 'inventory.description-too-long'),
    };
  }

  private static seed(): StoredItem[] {
    const at = new Date(Date.now() - 20 * 86_400_000).toISOString();
    const item = (id: string, name: string, category: string, quantity: number, description: string | null = null): StoredItem =>
      ({ id, name, category, quantity, description, createdAt: at, updatedAt: at });
    return [
      item('i-balls', 'Volleybälle Mikasa V200W', 'Bälle', 24),
      item('i-training-balls', 'Trainingsbälle', 'Bälle', 30),
      item('i-cart', 'Ballwagen', 'Ausrüstung', 3),
      item('i-net', 'Netz Wettkampf', 'Ausrüstung', 2, 'Mit Antennen und Seitenbändern.'),
      item('i-pump', 'Ballpumpe mit Manometer', 'Ausrüstung', 2),
      item('i-jerseys', 'Trikotsatz Damen', 'Trikots', 14),
      item('i-first-aid', 'Erste-Hilfe-Koffer', 'Sanität', 2, 'Kühlpacks nach Gebrauch ersetzen.'),
      item('i-scoreboard', 'Anzeigetafel', 'Spielbetrieb', 1),
    ];
  }

  /** Mostly in the halls; the coach and a player hold some at home. */
  private static seedStock(): Record<string, StockInput[]> {
    const at = (locationId: string, quantity: number): StockInput => ({ locationId, holderId: null, quantity });
    const by = (holderId: string, quantity: number): StockInput => ({ locationId: null, holderId, quantity });
    return {
      'i-balls': [at('l-nord', 18), by('trainer', 6)],
      'i-training-balls': [at('l-sued', 30)],
      'i-cart': [at('l-nord', 3)],
      'i-net': [at('l-west', 2)],
      'i-pump': [by('trainer', 1), by('spielerin', 1)],
      'i-jerseys': [by('spielerin', 14)],
      'i-first-aid': [at('l-heim', 1), by('trainer', 1)],
      'i-scoreboard': [at('l-nord', 1)],
    };
  }
}

export const inventory = new MockInventory(directory);

linkRefs.items = (ids) =>
  new Map(inventory.items.data.filter((i) => ids.includes(i.id)).map((i) => [i.id, { name: i.name, quantity: i.quantity, places: inventory.places(i.id) }]));

const actor = (req: MockRequest) => directory.actor(req);
/** server: InventoryHandlers.requireMaySee - only admin, board and coaches see the inventory. */
const viewer = (req: MockRequest) => {
  const member = actor(req);
  directory.requireRole(member);
  return member;
};

mockServer
  .on('GET', '/api/v1/inventory', (req) => (viewer(req), { items: inventory.list() }))
  .on('POST', '/api/v1/inventory', (req) => inventory.create(actor(req), req.body ?? {}))
  .on('GET', '/api/v1/inventory/mine', (req) => inventory.mine(actor(req)))
  .on('GET', '/api/v1/inventory/held/:memberId', (req) => {
    // server: InventoryHandlers.heldBy - privileged, the member, their guardians
    const viewer = actor(req);
    const id = req.params.memberId;
    if (viewer.id !== id && !directory.isPrivileged(viewer) && !directory.wardsOf(viewer.id).includes(id)) MockServer.fail(404, 'member.not-found');
    return inventory.mine({ ...viewer, id });
  })
  .on('GET', '/api/v1/inventory/:id', (req) => (viewer(req), inventory.get(req.params.id)))
  .on('GET', '/api/v1/inventory/:id/uses', (req) => {
    const member = viewer(req);
    inventory.get(req.params.id);
    const uses = itemUseSources.flatMap((source) => source(member, req.params.id));
    return { uses: uses.sort((a, b) => (a.at === b.at ? 0 : a.at === null ? 1 : b.at === null ? -1 : a.at.localeCompare(b.at))) };
  })
  .on('PATCH', '/api/v1/inventory/:id', (req) => inventory.update(actor(req), req.params.id, req.body ?? {}))
  .on('PUT', '/api/v1/inventory/:id/stock', (req) => inventory.setStock(actor(req), req.params.id, req.body?.entries))
  .on('DELETE', '/api/v1/inventory/:id', (req) => inventory.delete(actor(req), req.params.id));
