import { ListModel } from '../../lib/list/ListModel.svelte';
import type { LocalStore } from '../../lib/storage/LocalStore';
import type { InventoryApi } from './InventoryApi';
import type { Item } from './model';

/** The inventory list: search, category filter, sorting by name, category, stock or place. */
export class InventoryListModel extends ListModel<Item> {
  constructor(api: InventoryApi, store: LocalStore) {
    super(
      {
        id: 'inventory',
        load: () => api.list(),
        defaultSort: { key: 'name', dir: 'asc' },
        searchText: (i) => `${i.name} ${i.category ?? ''} ${i.location ?? ''} ${i.description ?? ''}`,
        columns: [
          { key: 'name', label: 'Name', value: (i) => i.name },
          { key: 'category', label: 'Kategorie', value: (i) => i.category, width: '10rem' },
          { key: 'quantity', label: 'Bestand', value: (i) => i.quantity, width: '6rem', align: 'end' },
          { key: 'location', label: 'Ort', value: (i) => i.location, width: '12rem', hideOnCompact: true },
        ],
        filters: [
          {
            key: 'category',
            label: 'Kategorie',
            kind: 'select',
            allLabel: 'Alle Kategorien',
            options: (items) => InventoryListModel.categories(items).map((c) => ({ value: c, label: c })),
            test: (i, value) => i.category === value,
          },
        ],
      },
      store,
    );
  }

  /** Distinct categories, sorted. */
  static categories(items: readonly Item[]): string[] {
    return [...new Set(items.flatMap((i) => (i.category ? [i.category] : [])))].sort((a, b) => a.localeCompare(b, 'de'));
  }
}
