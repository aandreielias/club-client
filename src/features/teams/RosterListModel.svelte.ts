import { ListModel } from '../../lib/list/ListModel.svelte';
import type { LocalStore } from '../../lib/storage/LocalStore';
import { TEAM_ROLE_LABELS, type RosterEntry } from '../../lib/types';
import type { RosterModel } from './RosterModel.svelte';


/** A team's members as a list; data comes from the RosterModel (which also performs the changes). */
export class RosterListModel extends ListModel<RosterEntry> {
  constructor(roster: RosterModel, store: LocalStore) {
    super(
      {
        id: 'roster',
        load: async () => {
          await roster.load();
          return roster.roster.value?.entries ?? [];
        },
        defaultSort: { key: 'role', dir: 'asc' },
        searchText: (e) => e.name,
        columns: [
          { key: 'name', label: 'Name', value: (e) => e.name },
          { key: 'role', label: 'Rolle im Team', value: (e) => (e.teamRole === 'COACH' ? 0 : 1), format: (e) => TEAM_ROLE_LABELS[e.teamRole], width: '12rem' },
          { key: 'actions', label: 'Aktionen', value: () => null, sortable: false, width: '7rem', align: 'end' },
        ],
        filters: [
          {
            key: 'role',
            label: 'Rolle',
            kind: 'select',
            allLabel: 'Alle Rollen',
            options: () => Object.entries(TEAM_ROLE_LABELS).map(([value, label]) => ({ value, label })),
            test: (e, value) => e.teamRole === value,
          },
        ],
      },
      store,
    );
  }
}
