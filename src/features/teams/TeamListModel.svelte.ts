import { ListModel } from '../../lib/list/ListModel.svelte';
import type { SessionStore } from '../../lib/session/SessionStore.svelte';
import type { LocalStore } from '../../lib/storage/LocalStore';
import type { Team } from '../../lib/types';

/** Teams: every team for admin/board, otherwise the member's own. */
export class TeamListModel extends ListModel<Team> {
  constructor(load: () => Promise<Team[]>, session: SessionStore, store: LocalStore) {
    super(
      {
        id: 'teams',
        load,
        defaultSort: { key: 'season', dir: 'desc' },
        searchText: (t) => t.name,
        columns: [
          { key: 'name', label: 'Team', value: (t) => t.name },
          { key: 'season', label: 'Saison', value: (t) => t.season, width: '8rem' },
          { key: 'mine', label: 'Mitglied', value: (t) => (session.isInTeam(t.id) ? 'Ja' : 'Nein'), width: '8rem' },
        ],
        filters: [
          {
            key: 'season',
            label: 'Saison',
            kind: 'select',
            allLabel: 'Alle Saisonen',
            options: () => [...new Set((this.data.value ?? []).map((t) => t.season))].sort().reverse().map((s) => ({ value: s, label: s })),
            test: (t, value) => t.season === value,
          },
          { key: 'mine', label: 'Nur meine', kind: 'toggle', test: (t, on) => !on || session.isInTeam(t.id) },
        ],
      },
      store,
    );
  }
}
