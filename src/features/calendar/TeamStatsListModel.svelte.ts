import { ListModel } from '../../lib/list/ListModel.svelte';
import type { LocalStore } from '../../lib/storage/LocalStore';
import type { MemberStats, TeamStats } from './model';

const percent = (part: number, whole: number) => (whole ? `${Math.round((100 * part) / whole)} %` : '–');

/** Answers and presence per team member over a range; the range comes from `load`. */
export class TeamStatsListModel extends ListModel<MemberStats> {
  /** Appointments held in the range. */
  appointments = $state(0);

  constructor(load: () => Promise<TeamStats>, store: LocalStore | null) {
    super(
      {
        id: 'team-stats',
        load: async () => {
          const stats = await load();
          this.appointments = stats.appointments;
          return stats.items;
        },
        defaultSort: { key: 'name', dir: 'asc' },
        columns: [
          { key: 'name', label: 'Name', value: (m) => m.name },
          {
            key: 'yes',
            label: 'Zusagen',
            value: (m) => m.yes,
            format: (m) => `${m.yes} (${percent(m.yes, m.appointments)})`,
            width: '9rem',
            align: 'end',
          },
          { key: 'no', label: 'Absagen', value: (m) => m.no, width: '7rem', align: 'end' },
          {
            key: 'present',
            label: 'Da',
            value: (m) => (m.marked ? m.present / m.marked : null),
            format: (m) => (m.marked ? `${m.present} von ${m.marked} (${percent(m.present, m.marked)})` : '–'),
            width: '11rem',
            align: 'end',
          },
        ],
      },
      store,
    );
  }
}
