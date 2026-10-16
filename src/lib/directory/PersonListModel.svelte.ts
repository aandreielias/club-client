import { ListModel } from '../list/ListModel.svelte';
import type { LocalStore } from '../storage/LocalStore';
import type { RosterEntry } from '../types';
import type { TeamDirectory } from './TeamDirectory.svelte';

export type Person = Pick<RosterEntry, 'memberId' | 'name'>;

/**
 * People to choose from (photo tags, task assignees) as the app's standard list: search, team
 * filter, "only chosen" filter and sorting, rendered with DataTable checkboxes by PeoplePicker.
 */
export class PersonListModel extends ListModel<Person> {
  constructor(
    load: () => Promise<readonly Person[]>,
    directory: TeamDirectory,
    /** Whether a person is currently chosen (for the "only chosen" filter). */
    isChosen: (memberId: string) => boolean,
    store: LocalStore | null,
    id: string,
  ) {
    const teams = (p: Person) => directory.teamsOf(p.memberId);
    super(
      {
        id,
        load: async () => [...(await load())],
        defaultSort: { key: 'name', dir: 'asc' },
        searchText: (p) => `${p.name} ${teams(p).join(' ')}`,
        columns: [
          { key: 'name', label: 'Name', value: (p) => p.name },
          { key: 'teams', label: 'Teams', value: (p) => teams(p).join(', ') || null, hideOnCompact: true },
        ],
        filters: [
          {
            key: 'team',
            label: 'Team',
            kind: 'select',
            allLabel: 'Alle Teams',
            options: (items) => [...new Set(items.flatMap(teams))].sort((a, b) => a.localeCompare(b, 'de')).map((t) => ({ value: t, label: t })),
            test: (p, value) => teams(p).includes(value),
          },
          { key: 'chosen', label: 'Nur ausgewählte', kind: 'toggle', test: (p, on) => !on || isChosen(p.memberId) },
        ],
      },
      store,
    );
  }
}
