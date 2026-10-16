// Mock of the club-server inventory module (InventoryHandlers): everyone reads, admin/board/coaches manage.
import { settings } from '../../settings';
import { directory, type MockDirectory } from '../../lib/mock/core';
import { itemUseSources, linkRefs } from '../../lib/mock/MockLinks';
import { MockServer, mockServer, type MockRequest } from '../../lib/mock/MockServer';
import { MockTable } from '../../lib/mock/MockTable';
import { PRIVILEGED, type Member } from '../../lib/types';
import type { Item, NewItem } from './model';

const fail = MockServer.fail;
const limits = settings.inventory;

export class MockInventory {
  readonly items: MockTable<Item[]>;

  constructor(private readonly people: MockDirectory) {
    this.items = new MockTable('inventory', () => MockInventory.seed());
  }

  list(): Item[] {
    return [...this.items.data].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }

  get(id: string): Item {
    return this.items.data.find((i) => i.id === id) ?? fail(404, 'inventory.not-found');
  }

  create(member: Member, body: Partial<NewItem>): Item {
    this.people.requirePrivileged(member, PRIVILEGED);
    const now = new Date().toISOString();
    const item = MockInventory.validated({
      id: crypto.randomUUID(),
      name: body.name ?? '',
      category: body.category ?? null,
      quantity: body.quantity ?? 0,
      location: body.location ?? null,
      description: body.description ?? null,
      createdAt: now,
      updatedAt: now,
    });
    this.items.data.push(item);
    this.items.save();
    this.changed(item.id, 'CREATED');
    return item;
  }

  /** Null fields stay unchanged; an empty text clears it. */
  update(member: Member, id: string, patch: Partial<NewItem>): Item {
    this.people.requirePrivileged(member, PRIVILEGED);
    const current = this.get(id);
    const next = MockInventory.validated({
      ...current,
      name: patch.name ?? current.name,
      category: patch.category ?? current.category,
      quantity: patch.quantity ?? current.quantity,
      location: patch.location ?? current.location,
      description: patch.description ?? current.description,
      updatedAt: new Date().toISOString(),
    });
    Object.assign(current, next);
    this.items.save();
    this.changed(id, 'UPDATED');
    return current;
  }

  delete(member: Member, id: string): void {
    this.people.requirePrivileged(member, PRIVILEGED);
    const item = this.get(id);
    this.items.data.splice(this.items.data.indexOf(item), 1);
    this.items.save();
    this.changed(id, 'DELETED');
  }

  private changed(itemId: string, change: string): void {
    mockServer.events.publish({ type: 'inventory.item-changed', data: { itemId, change }, audience: { roles: PRIVILEGED } });
  }

  /** server: Item constructor checks */
  private static validated(item: Item): Item {
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
      location: text(item.location, limits.locationMaxLength, 'inventory.location-invalid'),
      description: text(item.description, limits.descriptionMaxLength, 'inventory.description-too-long'),
    };
  }

  private static seed(): Item[] {
    const at = new Date(Date.now() - 20 * 86_400_000).toISOString();
    const item = (id: string, name: string, category: string, quantity: number, location: string, description: string | null = null): Item =>
      ({ id, name, category, quantity, location, description, createdAt: at, updatedAt: at });
    return [
      item('i-balls', 'Volleybälle Mikasa V200W', 'Bälle', 24, 'Geräteraum Halle 1'),
      item('i-training-balls', 'Trainingsbälle', 'Bälle', 30, 'Geräteraum Halle 1'),
      item('i-cart', 'Ballwagen', 'Ausrüstung', 3, 'Geräteraum Halle 1'),
      item('i-net', 'Netz Wettkampf', 'Ausrüstung', 2, 'Geräteraum Halle 2', 'Mit Antennen und Seitenbändern.'),
      item('i-pump', 'Ballpumpe mit Manometer', 'Ausrüstung', 2, 'Trainerschrank'),
      item('i-jerseys', 'Trikotsatz Damen', 'Trikots', 14, 'Vereinsheim'),
      item('i-first-aid', 'Erste-Hilfe-Koffer', 'Sanität', 2, 'Trainerschrank', 'Kühlpacks nach Gebrauch ersetzen.'),
      item('i-scoreboard', 'Anzeigetafel', 'Spielbetrieb', 1, 'Halle 1'),
    ];
  }
}

export const inventory = new MockInventory(directory);

linkRefs.items = (ids) =>
  new Map(inventory.items.data.filter((i) => ids.includes(i.id)).map((i) => [i.id, { name: i.name, quantity: i.quantity }]));

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
  .on('GET', '/api/v1/inventory/:id', (req) => (viewer(req), inventory.get(req.params.id)))
  .on('GET', '/api/v1/inventory/:id/uses', (req) => {
    const member = viewer(req);
    inventory.get(req.params.id);
    const uses = itemUseSources.flatMap((source) => source(member, req.params.id));
    return { uses: uses.sort((a, b) => (a.at === b.at ? 0 : a.at === null ? 1 : b.at === null ? -1 : a.at.localeCompare(b.at))) };
  })
  .on('PATCH', '/api/v1/inventory/:id', (req) => inventory.update(actor(req), req.params.id, req.body ?? {}))
  .on('DELETE', '/api/v1/inventory/:id', (req) => inventory.delete(actor(req), req.params.id));
