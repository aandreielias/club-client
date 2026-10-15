import type { CalendarEntry, CalendarSources } from '../../lib/calendar/CalendarSources';
import type { TeamDirectory } from '../../lib/directory/TeamDirectory.svelte';
import { ListModel } from '../../lib/list/ListModel.svelte';
import type { LocalStore } from '../../lib/storage/LocalStore';
import type { Formatter } from '../../lib/time/Formatter';
import { ZonedClock } from '../../lib/time/ZonedClock';

/** Start page: everything of the next days from all calendar sources (appointments, due tasks). */
export class HomeAgendaModel extends ListModel<CalendarEntry> {
  constructor(sources: CalendarSources, clock: ZonedClock, days: number, format: () => Formatter, directory: TeamDirectory, store: LocalStore) {
    super(
      {
        id: 'home-agenda',
        load: (server) => {
          const today = clock.today();
          const enabled = server.source ? new Set([server.source]) : undefined;
          return sources.load(clock.startOfDay(today), clock.startOfDay(ZonedClock.addDays(today, days)), enabled);
        },
        defaultSort: { key: 'start', dir: 'asc' },
        columns: [
          { key: 'title', label: 'Titel', value: (e) => e.title },
          { key: 'start', label: 'Wann', value: (e) => e.start, format: (e) => format().dateTime(e.start), width: '12rem' },
          { key: 'label', label: 'Art', value: (e) => e.label, width: '9rem' },
          { key: 'team', label: 'Für', value: (e) => (e.teamId ? (directory.teamName(e.teamId) ?? 'Team') : 'Verein'), width: '9rem', hideOnCompact: true },
        ],
        filters: [
          {
            key: 'source',
            label: 'Art',
            kind: 'select',
            allLabel: 'Alles',
            options: () => sources.all.map((s) => ({ value: s.id, label: s.label })),
          },
        ],
      },
      store,
    );
  }
}
