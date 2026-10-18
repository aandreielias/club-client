// Mock of the server's platform.LinkResolver plus the link tables of one module (calendar or tasks).
import { settings } from '../../settings';
import type { StockPlace, FileRef, Links, Need } from '../links/model';
import { PRIVILEGED, type Member } from '../types';
import { MockServer } from './MockServer';
import { MockTable } from './MockTable';

const fail = MockServer.fail;
const limits = settings.links;

interface NeedRow {
  itemId: string;
  name: string;
  quantity: number;
}

/** server: FilesApi.FileLink */
export interface FileLink {
  fileId: string;
  folderId: string | null;
  name: string | null;
}

interface Rows {
  needs: NeedRow[];
  files: FileLink[];
}

/**
 * Lookups the inventory and files mocks register (server: InventoryApi.REFS, FilesApi.FILE_REFS
 * over the bus), so link handling needs no feature imports.
 */
export const linkRefs = {
  items: (_ids: readonly string[]): Map<string, { name: string; quantity: number; places: StockPlace[] }> => new Map(),
  files: (_member: Member, _links: readonly FileLink[]): FileRef[] => [],
};

/** server: InventoryApi.ItemUse */
export interface ItemUse {
  kind: 'APPOINTMENT' | 'TASK';
  id: string;
  title: string;
  at: string | null;
  quantity: number;
}

/** Calendar and tasks register here what they answer to GetItemUses (server: CalendarApi/TasksApi.ITEM_USES). */
export const itemUseSources: ((member: Member, itemId: string) => ItemUse[])[] = [];

export class MockLinks {
  /** ownerId → stored rows */
  readonly table: MockTable<Record<string, Rows>>;

  constructor(name: string, seed: () => Record<string, Rows> = () => ({})) {
    this.table = new MockTable(name, seed);
  }

  get(member: Member, ownerId: string): Links {
    return MockLinks.resolve(member, this.rows(ownerId));
  }

  /** Callers check visibility and edit rights first. */
  set(member: Member, ownerId: string, body: { needs?: unknown; fileIds?: unknown }): Links {
    const needs = Array.isArray(body.needs) ? (body.needs as { itemId?: string; quantity?: number }[]) : [];
    const fileIds = Array.isArray(body.fileIds) ? (body.fileIds as string[]) : [];
    const stored = this.rows(ownerId);
    if (needs.length > limits.maxEntries || fileIds.length > limits.maxEntries) fail(400, 'links.too-many');
    for (const need of needs) {
      if (!need?.itemId || !Number.isInteger(need.quantity) || need.quantity! < 1 || need.quantity! > limits.maxQuantity) {
        fail(400, 'links.quantity-invalid');
      }
    }
    if (new Set(needs.map((n) => n.itemId)).size !== needs.length || new Set(fileIds).size !== fileIds.length || fileIds.some((id) => !id)) {
      fail(400, 'links.duplicate');
    }
    const items = linkRefs.items(needs.map((n) => n.itemId!));
    const needRows = needs.map((n): NeedRow => {
      const name = items.get(n.itemId!)?.name ?? stored.needs.find((s) => s.itemId === n.itemId)?.name;
      if (!name) return fail(400, 'links.item-unknown');
      return { itemId: n.itemId!, name, quantity: n.quantity! };
    });
    const asked = [...stored.files, ...fileIds.filter((id) => !stored.files.some((f) => f.fileId === id)).map((id) => ({ fileId: id, folderId: null, name: null }))];
    const refs = new Map(linkRefs.files(member, asked).map((r) => [r.id, r]));
    const fileRows = fileIds.map((id): FileLink => {
      const ref = refs.get(id) ?? fail(400, 'links.file-unknown');
      return { fileId: id, folderId: ref.folderId, name: ref.name };
    });
    // Attachments the actor cannot see stay attached.
    fileRows.push(...stored.files.filter((f) => !refs.has(f.fileId)));
    this.table.data[ownerId] = { needs: needRows, files: fileRows };
    this.table.save();
    return MockLinks.resolve(member, this.table.data[ownerId]);
  }

  /** ownerId → quantity of every owner whose list needs the item. */
  owners(itemId: string): [string, number][] {
    return Object.entries(this.table.data).flatMap(([owner, rows]) =>
      rows.needs.filter((n) => n.itemId === itemId).map((n): [string, number] => [owner, n.quantity]));
  }

  remove(ownerId: string): void {
    delete this.table.data[ownerId];
    this.table.save();
  }

  private rows(ownerId: string): Rows {
    return this.table.data[ownerId] ?? { needs: [], files: [] };
  }

  /** server: LinkResolver.resolve - stock and whereabouts are inventory data, privileged viewers only (others: what they hold). */
  private static resolve(member: Member, rows: Rows): Links {
    const items = linkRefs.items(rows.needs.map((n) => n.itemId));
    const privileged = member.roles.some((r) => PRIVILEGED.includes(r));
    const needs = rows.needs.map((n): Need => {
      const ref = items.get(n.itemId);
      if (!ref) return { itemId: n.itemId, name: n.name, quantity: n.quantity, stock: null, deleted: true, places: [] };
      const places = privileged ? ref.places : ref.places.filter((p) => p.kind === 'PERSON' && p.id === member.id);
      return { itemId: n.itemId, name: ref.name, quantity: n.quantity, stock: privileged ? ref.quantity : null, deleted: false, places };
    });
    return { needs, files: rows.files.length ? linkRefs.files(member, rows.files) : [] };
  }
}
