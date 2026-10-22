import type { CalendarEntry, CalendarSource } from '../../lib/calendar/CalendarSources';
import { ZonedClock } from '../../lib/time/ZonedClock';
import type { TournamentSummary } from './model';
import type { TournamentsApi } from './TournamentsApi';

/** Tournaments in the calendar, all day from the first to the last day (one bar across the days). */
export class TournamentCalendarSource implements CalendarSource {
  readonly id = 'tournaments';
  readonly label = 'Turniere';

  constructor(
    private readonly api: TournamentsApi,
    private readonly clock: () => ZonedClock,
  ) {}

  async load(from: string, to: string): Promise<CalendarEntry[]> {
    const clock = this.clock();
    return (await this.api.list())
      .map((t) => TournamentCalendarSource.entry(t, clock))
      .filter((e) => e.start < to && (e.end ?? e.start) > from);
  }

  static entry(t: TournamentSummary, clock: ZonedClock): CalendarEntry {
    return {
      key: `tournament:${t.id}`,
      source: 'tournaments',
      title: t.name,
      start: clock.startOfDay(t.startsOn),
      // all-day end: the start of the day after the last day
      end: clock.startOfDay(ZonedClock.addDays(t.endsOn, 1)),
      allDay: true,
      hue: 'yellow',
      teamId: null,
      inactive: t.status === 'DONE',
      label: 'Turnier',
      window: { kind: 'tournament', id: t.id },
    };
  }
}
