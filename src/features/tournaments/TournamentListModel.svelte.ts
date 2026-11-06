import { ListModel } from '../../lib/list/ListModel.svelte';
import type { LocalStore } from '../../lib/storage/LocalStore';
import type { Formatter } from '../../lib/time/Formatter';
import { STATUS_LABELS, type TournamentSummary } from './model';
import type { TournamentsApi } from './TournamentsApi';

/** Turniere: upcoming by default, or the past ones; the server caps the list (`truncated`). */
export class TournamentListModel extends ListModel<TournamentSummary> {
  /** The server left older tournaments out. */
  truncated = $state(false);

  constructor(api: TournamentsApi, format: () => Formatter, today: () => string, store: LocalStore | null) {
    const days = (t: TournamentSummary) =>
      t.startsOn === t.endsOn ? format().date(t.startsOn) : `${format().date(t.startsOn)} – ${format().date(t.endsOn)}`;
    super(
      {
        id: 'tournaments',
        load: async () => {
          const page = await api.list();
          this.truncated = page.truncated;
          return page.items;
        },
        defaultSort: { key: 'date', dir: 'asc' },
        searchText: (t) => t.name,
        columns: [
          { key: 'name', label: 'Turnier', value: (t) => t.name },
          { key: 'date', label: 'Wann', value: (t) => t.startsOn, format: days, width: '14rem' },
          { key: 'teams', label: 'Teams', value: (t) => t.teams, width: '6rem', align: 'end', hideOnCompact: true },
          { key: 'status', label: 'Status', value: (t) => STATUS_LABELS[t.status], width: '9rem' },
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
            test: (t, v) => t.endsOn >= today() === (v === 'upcoming'),
          },
        ],
      },
      store,
    );
  }
}
