import type { CalendarEntry } from '../../lib/calendar/CalendarSources';
import type { TeamDirectory } from '../../lib/directory/TeamDirectory.svelte';
import { ListModel } from '../../lib/list/ListModel.svelte';
import type { LocalStore } from '../../lib/storage/LocalStore';
import type { Formatter } from '../../lib/time/Formatter';

/** The calendar's list view: the same entries as month and week, as a sortable table. */
export class CalendarListModel extends ListModel<CalendarEntry> {
  constructor(entries: () => CalendarEntry[], format: () => Formatter, directory: TeamDirectory, store: LocalStore) {
    super(
      {
        id: 'calendar-list',
        load: async () => entries(),
        defaultSort: { key: 'start', dir: 'asc' },
        searchText: (e) => e.title,
        columns: [
          { key: 'title', label: 'Titel', value: (e) => e.title },
          { key: 'start', label: 'Wann', value: (e) => e.start, format: (e) => format().dateTime(e.start), width: '12rem' },
          { key: 'label', label: 'Art', value: (e) => e.label, width: '9rem' },
          { key: 'team', label: 'Für', value: (e) => (e.teamId ? (directory.teamName(e.teamId) ?? 'Team') : 'Verein'), width: '9rem', hideOnCompact: true },
        ],
      },
      store,
    );
  }
}
