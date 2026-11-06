import { ListModel } from '../../lib/list/ListModel.svelte';
import type { LocalStore } from '../../lib/storage/LocalStore';
import type { Formatter } from '../../lib/time/Formatter';
import type { MeetingsApi } from './MeetingsApi';
import { STATUS_LABELS, type MeetingSummary } from './model';
import type { MeetingTypesStore } from './MeetingTypesStore.svelte';

/** Not yet over and not closed: what still needs planning or running. */
export const isUpcoming = (m: MeetingSummary, now: string) => m.endsAt >= now && m.status !== 'CLOSED';

/** Sitzungen: upcoming by default, or the past ones; search by title and place. */
export class MeetingListModel extends ListModel<MeetingSummary> {
  constructor(api: MeetingsApi, types: MeetingTypesStore, format: () => Formatter, now: () => string, store: LocalStore | null) {
    super(
      {
        id: 'meetings',
        load: () => api.list(),
        defaultSort: { key: 'start', dir: 'asc' },
        searchText: (m) => `${m.title} ${m.location ?? ''} ${types.label(m.kind)}`,
        columns: [
          { key: 'title', label: 'Sitzung', value: (m) => m.title },
          { key: 'start', label: 'Wann', value: (m) => m.startsAt, format: (m) => format().dateTime(m.startsAt), width: '12rem' },
          { key: 'kind', label: 'Art', value: (m) => types.label(m.kind), hideOnCompact: true },
          { key: 'status', label: 'Status', value: (m) => STATUS_LABELS[m.status], width: '9rem' },
        ],
        filters: [
          {
            key: 'when',
            label: 'Zeitraum',
            kind: 'select',
            allLabel: 'Alle',
            initial: 'upcoming',
            options: () => [
              { value: 'upcoming', label: 'Bevorstehend' },
              { value: 'past', label: 'Vergangen' },
            ],
            test: (m, v) => isUpcoming(m, now()) === (v === 'upcoming'),
          },
          {
            key: 'kind',
            label: 'Art',
            kind: 'select',
            allLabel: 'Alle Arten',
            options: (items) => [...new Set(items.map((m) => m.kind))].map((k) => ({ value: k, label: types.label(k) })),
            test: (m, v) => m.kind === v,
          },
        ],
      },
      store,
    );
  }
}
