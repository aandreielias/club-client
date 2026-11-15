import type { EventBus } from '../bus';
import { removeRecord, restoreRecord, type RemoveOps } from '../detail/removeRecord';
import type { CatalogItem } from '../state/CatalogStore.svelte';
import { inWindow, type RecordAction, type RecordActionProvider } from './RecordActions';

/**
 * The actions of a club type or kind (appointment, meeting and membership kinds…): edit; delete when unused, archive when used;
 * restore when archived. `may`: who manages them; `fixed`: entries that are never removed.
 */
export function catalogActions<K extends string, T extends CatalogItem<K>>(
  bus: EventBus,
  kind: string,
  noun: string,
  store: { load(): Promise<unknown>; get(key: K): T | undefined; ops(key: K): RemoveOps },
  may: () => boolean,
  fixed: (item: T) => boolean = () => false,
): RecordActionProvider<T> {
  return {
    load: async (key) => {
      await store.load();
      const item = store.get(key as K);
      // The menu then keeps only its open entries.
      if (!item) throw new Error(`${kind} ${key} not found`);
      return item;
    },
    actions: (item) => {
      if (!may()) return [];
      const ops = () => store.ops(item.key);
      const remove: RecordAction[] = item.archived
        ? [{ command: 'record.restore', group: 'edit', run: () => restoreRecord(bus, noun, ops()) }]
        : fixed(item)
          ? []
          : [
              {
                command: item.inUse ? 'record.archive' : 'record.delete',
                icon: item.inUse ? undefined : 'delete',
                danger: true,
                group: 'edit',
                leaves: !item.inUse,
                run: () => removeRecord(bus, item, noun, ops()),
              },
            ];
      return [inWindow(bus, kind, item.key, 'record.edit', { icon: 'edit', group: 'edit' }), ...remove];
    },
  };
}
