import type { CalendarEntry, CalendarSources } from '../../lib/calendar/CalendarSources';
import { categoryInfo, type CalendarCategory } from '../../lib/calendar/categories';
import { ListModel } from '../../lib/list/ListModel.svelte';
import type { LocalStore } from '../../lib/storage/LocalStore';
import { DateText } from '../../lib/time/DateText';
import { ZonedClock, type LocalDate } from '../../lib/time/ZonedClock';

/** Meeting-related calendar categories: meetings, deadlines (invitations, circular votes), term ends, follow-up tasks. */
export const DEADLINE_CATEGORIES: readonly CalendarCategory[] = ['MEETING', 'DEADLINE', 'OFFICE', 'FOLLOW_UP'];

/** The server answers at most 366 days per request. */
const CHUNK_DAYS = 365;
/** Terms run three years at most, so their ends lie that far ahead. */
const AHEAD_DAYS = 3 * CHUNK_DAYS;

/** Fristen: everything dated around the Sitzungen as one list, from the same calendar items the calendar shows. */
export class DeadlineListModel extends ListModel<CalendarEntry> {
  constructor(sources: CalendarSources, clock: () => ZonedClock, store: LocalStore | null) {
    const enabled = new Set<string>(DEADLINE_CATEGORIES);
    super(
      {
        id: 'deadlines',
        load: async ({ past }) => {
          const c = clock();
          const chunks = DeadlineListModel.chunks(c.today(), past === '1');
          const loaded = await Promise.all(chunks.map(([from, to]) => sources.load(c.startOfDay(from), c.startOfDay(to), enabled)));
          // An entry overlapping two chunks comes back twice.
          return [...new Map(loaded.flat().map((e) => [e.key, e] as const)).values()];
        },
        defaultSort: { key: 'start', dir: 'asc' },
        searchText: (e) => `${e.title} ${e.label}`,
        columns: [
          { key: 'start', label: 'Wann', value: (e) => DeadlineListModel.due(e), format: (e) => DeadlineListModel.when(e, clock()), width: '11rem' },
          { key: 'kind', label: 'Art', value: (e) => e.label, width: '13rem' },
          { key: 'title', label: 'Titel', value: (e) => e.title },
        ],
        filters: [
          {
            key: 'category',
            label: 'Art',
            kind: 'select',
            allLabel: 'Alle Arten',
            options: () => DEADLINE_CATEGORIES.map((c) => ({ value: c, label: categoryInfo(c).label })),
            test: (e, category) => e.source === category,
          },
          { key: 'done', label: 'Erledigte zeigen', kind: 'toggle', always: true, test: (e, on) => !!on || !e.inactive },
          { key: 'past', label: 'Vergangene', kind: 'toggle' },
        ],
      },
      store,
    );
  }

  /** Club-local [from, to) ranges: the next three years, or (past) the last year. */
  static chunks(today: LocalDate, past: boolean): [LocalDate, LocalDate][] {
    if (past) return [[ZonedClock.addDays(today, -CHUNK_DAYS), today]];
    const out: [LocalDate, LocalDate][] = [];
    for (let offset = 0; offset < AHEAD_DAYS; offset += CHUNK_DAYS) out.push([ZonedClock.addDays(today, offset), ZonedClock.addDays(today, offset + CHUNK_DAYS)]);
    return out;
  }

  /** The date that counts: a circular vote's deadline is its end, everything else its start. */
  static due(e: CalendarEntry): string {
    return e.source === 'DEADLINE' && e.end && !e.allDay ? e.end : e.start;
  }

  /** TT.MM.JJJJ, with the time for points in time. */
  static when(e: CalendarEntry, clock: ZonedClock): string {
    const local = clock.toLocal(DeadlineListModel.due(e));
    const date = DateText.format(local.slice(0, 10));
    return e.allDay ? date : `${date} ${local.slice(11)}`;
  }
}
