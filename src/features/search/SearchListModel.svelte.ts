import { settings } from '../../settings';
import { ListModel } from '../../lib/list/ListModel.svelte';
import type { LocalStore } from '../../lib/storage/LocalStore';
import type { Formatter } from '../../lib/time/Formatter';
import { HIT_KINDS, hitDetail, kindLabel, kindRank, type SearchHit } from './model';
import type { SearchApi } from './SearchApi';

/** Results of the global search for `query()`: one list of every kind, filterable by kind. */
export class SearchListModel extends ListModel<SearchHit> {
  constructor(api: SearchApi, query: () => string, format: () => Formatter, store: LocalStore) {
    super(
      {
        id: 'search',
        load: async () => (SearchListModel.searchable(query()) ? api.search(query(), settings.search.perKind) : []),
        defaultSort: { key: 'kind', dir: 'asc' },
        columns: [
          { key: 'title', label: 'Titel', value: (h) => h.title },
          { key: 'kind', label: 'Art', value: (h) => kindRank(h.kind), format: (h) => kindLabel(h.kind), width: '8rem' },
          { key: 'detail', label: 'Details', value: (h) => hitDetail(h), hideOnCompact: true },
          { key: 'at', label: 'Datum', value: (h) => h.at, format: (h) => (h.at ? format().dateTime(h.at) : ''), width: '11rem' },
        ],
        filters: [
          {
            key: 'kind',
            label: 'Art',
            kind: 'select',
            allLabel: 'Alle Arten',
            options: () => HIT_KINDS,
            test: (h, value) => h.kind === value,
          },
        ],
      },
      store,
    );
  }

  static searchable(query: string): boolean {
    const length = query.trim().length;
    return length >= settings.search.minQueryLength && length <= settings.search.maxQueryLength;
  }
}
