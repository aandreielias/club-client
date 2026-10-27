import type { CalendarEntry, CalendarSources } from './CalendarSources';
import type { TeamDirectory } from '../directory/TeamDirectory.svelte';
import { ListModel } from '../list/ListModel.svelte';
import type { LocalStore } from '../storage/LocalStore';
import type { Formatter } from '../time/Formatter';
import { ZonedClock } from '../time/ZonedClock';

export interface AgendaOptions {
  /** Key of the remembered filter and sort state. */
  id: string;
  days: number;
  /** Preselected calendar source (e.g. 'appointments'); none = all. */
  source?: string;
}

/** The next days from the calendar sources (appointments, due tasks) as a list; used on the start page. */
export class AgendaListModel extends ListModel<CalendarEntry> {
  constructor(
    sources: CalendarSources,
    clock: ZonedClock,
    options: AgendaOptions,
    format: () => Formatter,
    directory: TeamDirectory,
    store: LocalStore | null,
  ) {
    const days = options.days;
    super(
      {
        id: options.id,
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
          {
            key: 'team',
            label: 'Für',
            value: (e) => (e.teamId ? (directory.teamName(e.teamId) ?? 'Team') : 'Verein'),
            width: '9rem',
            hideOnCompact: true,
          },
        ],
        filters: [
          {
            key: 'source',
            label: 'Art',
            kind: 'select',
            allLabel: 'Alles',
            options: () => sources.all.map((s) => ({ value: s.id, label: s.label })),
            initial: options.source,
          },
        ],
      },
      store,
    );
  }
}
