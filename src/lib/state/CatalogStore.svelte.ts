import type { EventBus, EventChannel } from '../bus';
import type { RemoveOps } from '../detail/removeRecord';
import { saveOrder } from '../detail/saveOrder';
import type { LiveEvent } from '../live/LiveUpdates.svelte';
import { LiveStore } from './LiveStore.svelte';

/** A club-defined type or kind (appointment types, meeting types, membership kinds). */
export interface CatalogItem<K extends string> {
  key: K;
  label: string;
  archived: boolean;
  sort: number;
  inUse: boolean;
}

/** How the server saves and deletes one entry; `input` is the entry without its key and the server's flags. */
export interface CatalogWrites<K extends string, I> {
  save: (key: K, input: I) => Promise<unknown>;
  delete: (key: K) => Promise<unknown>;
}

/** The club's list of a type or kind: lookups, pickers, ordering and archiving. */
export class CatalogStore<K extends string, T extends CatalogItem<K>, I> extends LiveStore<readonly T[]> {
  constructor(
    fetch: () => Promise<readonly T[]>,
    bus: EventBus,
    changed: EventChannel<LiveEvent<unknown>>,
    initial: readonly T[],
    private readonly writes: CatalogWrites<K, I>,
  ) {
    super(fetch, bus, changed, initial);
  }

  get items(): readonly T[] {
    return this.value;
  }

  get(key: K): T | undefined {
    return this.value.find((t) => t.key === key);
  }

  /** Archived ones keep their name on what used them, marked; new records cannot choose them. */
  label(key: K): string {
    const found = this.get(key);
    return found ? (found.archived ? `${found.label} (archiviert)` : found.label) : key;
  }

  /** For pickers; what `current` holds stays offered even when archived. */
  options(current: K | readonly K[] = []): { value: K; label: string }[] {
    const kept = typeof current === 'string' ? [current] : current;
    return this.value.filter((t) => !t.archived || kept.includes(t.key)).map((t) => ({ value: t.key, label: t.label }));
  }

  /** New order from a dragged list (see saveOrder), then reloads. */
  async reorder(keys: readonly string[]): Promise<void> {
    await saveOrder(keys, this.value, (item, sort) => this.writes.save(item.key, { ...CatalogStore.input<I>(item), sort }));
    await this.load();
  }

  /** Delete, archive and reload one entry (removeRecord, restoreRecord). */
  ops(key: K): RemoveOps {
    const item = this.get(key)!;
    return {
      delete: () => this.writes.delete(key),
      archive: (archived) => this.writes.save(key, { ...CatalogStore.input<I>(item), archived }),
      reload: () => this.load(),
    };
  }

  private static input<I>(item: object): I {
    const { key: _key, inUse: _inUse, fixed: _fixed, ...input } = item as Record<string, unknown>;
    return input as I;
  }
}
