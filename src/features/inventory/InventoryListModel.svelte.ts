import { ListModel } from '../../lib/list/ListModel.svelte';
import type { LocalStore } from '../../lib/storage/LocalStore';
import type { InventoryApi } from './InventoryApi';
import { placeName, stockSummary, type Item } from './model';

/** The inventory list: search, category filter, sorting by name, category, stock or place. */
export class InventoryListModel extends ListModel<Item> {
  constructor(api: InventoryApi, store: LocalStore | null) {
    super(
      {
        id: 'inventory',
        load: () => api.list(),
        defaultSort: { key: 'name', dir: 'asc' },
        searchText: (i) => `${i.name} ${i.category ?? ''} ${i.stock.map(placeName).join(' ')} ${i.description ?? ''}`,
        columns: [
          { key: 'name', label: 'Name', value: (i) => i.name },
          { key: 'category', label: 'Kategorie', value: (i) => i.category, width: '10rem' },
          { key: 'quantity', label: 'Bestand', value: (i) => i.quantity, width: '6rem', align: 'end' },
          { key: 'where', label: 'Wo', value: (i) => stockSummary(i.stock), width: '14rem', hideOnCompact: true },
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
