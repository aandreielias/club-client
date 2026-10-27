import type { TeamDirectory } from '../../lib/directory/TeamDirectory.svelte';
import { ListModel } from '../../lib/list/ListModel.svelte';
import type { LocalStore } from '../../lib/storage/LocalStore';
import type { Formatter } from '../../lib/time/Formatter';
import { ZonedClock, type LocalDate } from '../../lib/time/ZonedClock';
import type { CalendarApi } from './CalendarApi';
import type { Appointment } from './model';
import { appointmentTypes } from './services';

/** The server answers at most 366 days per request (CalendarApi.list). */
const WINDOW_DAYS = 365;

/** The Events tab: every appointment the member sees, the coming year or (switch) the past one. */
export class EventListModel extends ListModel<Appointment> {
  constructor(api: CalendarApi, clock: ZonedClock, format: () => Formatter, directory: TeamDirectory, store: LocalStore | null) {
    super(
      {
        id: 'events',
        load: ({ past }) => {
          const { from, to } = EventListModel.range(clock.today(), past === '1');
          return api.list(clock.startOfDay(from), clock.startOfDay(to), null);
        },
        defaultSort: { key: 'start', dir: 'asc' },
        searchText: (a) => `${a.title} ${a.location ?? ''}`,
        columns: [
          { key: 'title', label: 'Titel', value: (a) => a.title },
          { key: 'start', label: 'Wann', value: (a) => a.startsAt, format: (a) => format().dateTime(a.startsAt), width: '12rem' },
          { key: 'type', label: 'Art', value: (a) => appointmentTypes.label(a.type), width: '9rem' },
          { key: 'team', label: 'Für', value: (a) => EventListModel.audience(a, directory), width: '9rem', hideOnCompact: true },
          { key: 'location', label: 'Ort', value: (a) => a.location, hideOnCompact: true },
        ],
        filters: [
          {
            key: 'type',
            label: 'Art',
            kind: 'select',
            allLabel: 'Alle Arten',
            options: () => appointmentTypes.options(),
            test: (a, type) => a.type === type,
          },
          {
            key: 'team',
            label: 'Team',
            kind: 'select',
            allLabel: 'Alle Teams',
            options: (items) =>
              [...new Map(items.filter((a) => a.teamId).map((a) => [a.teamId!, EventListModel.audience(a, directory)])).entries()].map(
                ([value, label]) => ({ value, label }),
              ),
            test: (a, team) => a.teamId === team,
          },
          { key: 'past', label: 'Vergangene', kind: 'toggle' },
        ],
      },
      store,
    );
  }

  static audience(a: Appointment, directory: TeamDirectory): string {
    return a.teamId ? (directory.teamName(a.teamId) ?? 'Team') : 'Verein';
  }

  /** Club-local days to load: [today, +365) upcoming, [-365, today) past. */
  static range(today: LocalDate, past: boolean): { from: LocalDate; to: LocalDate } {
    return past ? { from: ZonedClock.addDays(today, -WINDOW_DAYS), to: today } : { from: today, to: ZonedClock.addDays(today, WINDOW_DAYS) };
  }
}
