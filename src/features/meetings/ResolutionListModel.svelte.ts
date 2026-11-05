import { ListModel } from '../../lib/list/ListModel.svelte';
import type { LocalStore } from '../../lib/storage/LocalStore';
import type { MeetingsApi } from './MeetingsApi';
import { RESULT_LABELS, type Result, type ResolutionSummary } from './model';

/** State of a Beschluss in one word: its result once closed, else open or draft. */
export function resolutionState(r: ResolutionSummary): string {
  if (r.result) return RESULT_LABELS[r.result];
  return r.status === 'OPEN' ? 'Offen' : 'Entwurf';
}

/**
 * Every Beschluss the member may see (meetings and circular votes): the year is asked from the server (it caps an unfiltered
 * list, `truncated`), result and kind filter here.
 */
export class ResolutionListModel extends ListModel<ResolutionSummary> {
  /** The server cut the list (more than it answers at once); a year shows all of that year. */
  truncated = $state(false);

  constructor(api: MeetingsApi, thisYear: number, store: LocalStore | null) {
    const years = Array.from({ length: 6 }, (_, i) => String(thisYear - i));
    super(
      {
        id: 'resolutions',
        load: async (server) => {
          const page = await api.allResolutions(server.year ? Number(server.year) : null);
          this.truncated = page.truncated;
          return page.items;
        },
        defaultSort: { key: 'date', dir: 'desc' },
        searchText: (r) => `${r.title} ${r.meetingTitle ?? 'Umlaufbeschluss'}`,
        columns: [
          { key: 'title', label: 'Beschluss', value: (r) => r.title },
          { key: 'state', label: 'Ergebnis', value: resolutionState, width: '9rem' },
          { key: 'meeting', label: 'Gefasst in', value: (r) => r.meetingTitle ?? 'Umlaufbeschluss', hideOnCompact: true },
          {
            key: 'date',
            label: 'Datum',
            value: (r) => r.closedAt ?? r.openedAt,
            width: '8rem',
          },
        ],
        filters: [
          {
            key: 'year',
            label: 'Jahr',
            kind: 'select',
            allLabel: 'Alle Jahre',
            options: () => years.map((y) => ({ value: y, label: y })),
          },
          {
            key: 'result',
            label: 'Ergebnis',
            kind: 'select',
            allLabel: 'Alle Ergebnisse',
            options: () => [
              { value: 'OPEN', label: 'Offen' },
              ...(Object.keys(RESULT_LABELS) as Result[]).map((r) => ({ value: r, label: RESULT_LABELS[r] })),
            ],
            test: (r, v) => (v === 'OPEN' ? r.status === 'OPEN' : r.result === v),
          },
          {
            key: 'kind',
            label: 'Art',
            kind: 'select',
            allLabel: 'Sitzungen und Umlauf',
            options: () => [
              { value: 'MEETING', label: 'In Sitzungen' },
              { value: 'CIRCULAR', label: 'Umlaufbeschlüsse' },
            ],
            test: (r, v) => (v === 'CIRCULAR') === (r.meetingId === null),
          },
        ],
      },
      store,
    );
  }
}
