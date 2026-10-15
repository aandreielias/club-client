import type { CalendarEntry, CalendarSources } from '../../lib/calendar/CalendarSources';
import { Resource } from '../../lib/state/Resource.svelte';
import type { LocalStore } from '../../lib/storage/LocalStore';
import { ZonedClock, type LocalDate } from '../../lib/time/ZonedClock';

export type CalendarView = 'month' | 'week' | 'list';

export const CALENDAR_VIEWS: readonly { value: CalendarView; label: string }[] = [
  { value: 'month', label: 'Monat' },
  { value: 'week', label: 'Woche' },
  { value: 'list', label: 'Liste' },
];

export interface CalendarPosition {
  view: CalendarView;
  date: LocalDate;
  teamId: string | null;
}

export interface DayRange {
  /** First day shown. */
  from: LocalDate;
  /** Day after the last day shown. */
  to: LocalDate;
}

/** A timed entry placed on the week grid: offsets in percent of the visible hours, side-by-side lanes for overlaps. */
export interface PlacedEntry {
  entry: CalendarEntry;
  top: number;
  height: number;
  lane: number;
  lanes: number;
}

const MONTH_GRID_DAYS = 42;
const HIDDEN_KEY = 'calendar.hidden-sources';

/**
 * The calendar page: one view (month, week or list) around an anchor date, entries of all
 * registered sources for the visible range, filtered by source and team. Days are club-local.
 */
export class CalendarModel {
  view = $state<CalendarView>('month');
  anchor = $state<LocalDate>('');
  teamId = $state<string | null>(null);
  hidden = $state<string[]>([]);

  readonly entries: Resource<CalendarEntry[]>;
  readonly range: DayRange;
  readonly days: LocalDate[];
  readonly visible: CalendarEntry[];
  readonly byDay: Map<LocalDate, CalendarEntry[]>;

  constructor(
    private readonly sources: CalendarSources,
    private readonly clock: ZonedClock,
    private readonly agendaDays: number,
    private readonly store: LocalStore | null,
    initial: Partial<CalendarPosition> = {},
  ) {
    this.view = initial.view && ['month', 'week', 'list'].includes(initial.view) ? initial.view : 'month';
    this.anchor = initial.date && /^\d{4}-\d{2}-\d{2}$/.test(initial.date) ? initial.date : clock.today();
    this.teamId = initial.teamId ?? null;
    this.hidden = store?.get<string[]>(HIDDEN_KEY) ?? [];
    this.range = $derived(CalendarModel.rangeOf(this.view, this.anchor, this.agendaDays));
    this.days = $derived(CalendarModel.daysOf(this.range));
    this.entries = new Resource(() =>
      this.sources.load(this.clock.startOfDay(this.range.from), this.clock.startOfDay(this.range.to), this.enabledSources()),
    );
    this.visible = $derived((this.entries.value ?? []).filter((e) => !this.teamId || e.teamId === this.teamId));
    this.byDay = $derived(this.bucket(this.visible));
  }

  get position(): CalendarPosition {
    return { view: this.view, date: this.anchor, teamId: this.teamId };
  }

  get today(): LocalDate {
    return this.clock.today();
  }

  load(): Promise<void> {
    return this.entries.load();
  }

  setView(view: CalendarView): Promise<void> {
    this.view = view;
    return this.load();
  }

  /** Jumps to a day, optionally switching the view (e.g. "+n weitere" → week). */
  goTo(date: LocalDate, view: CalendarView = this.view): Promise<void> {
    this.anchor = date;
    this.view = view;
    return this.load();
  }

  next(): Promise<void> {
    return this.goTo(CalendarModel.step(this.view, this.anchor, 1, this.agendaDays));
  }

  previous(): Promise<void> {
    return this.goTo(CalendarModel.step(this.view, this.anchor, -1, this.agendaDays));
  }

  goToday(): Promise<void> {
    return this.goTo(this.clock.today());
  }

  setTeam(teamId: string | null): void {
    this.teamId = teamId;
  }

  isShown(sourceId: string): boolean {
    return !this.hidden.includes(sourceId);
  }

  toggleSource(sourceId: string): Promise<void> {
    this.hidden = this.isShown(sourceId) ? [...this.hidden, sourceId] : this.hidden.filter((id) => id !== sourceId);
    this.store?.set(HIDDEN_KEY, this.hidden);
    return this.load();
  }

  entriesOn(date: LocalDate): CalendarEntry[] {
    return this.byDay.get(date) ?? [];
  }

  /** True for days of the anchor's month (month view greys out the others). */
  inAnchorMonth(date: LocalDate): boolean {
    return date.slice(0, 7) === this.anchor.slice(0, 7);
  }

  /** Timed entries of one day placed on the week grid between `startHour` and `endHour`. */
  placeOn(date: LocalDate, startHour: number, endHour: number): PlacedEntry[] {
    const timed = this.entriesOn(date).filter((e) => !e.allDay && e.end);
    return CalendarModel.place(timed, date, startHour, endHour, this.clock);
  }

  // ---- pure helpers (unit-tested) ----

  static rangeOf(view: CalendarView, anchor: LocalDate, agendaDays: number): DayRange {
    if (view === 'list') return { from: anchor, to: ZonedClock.addDays(anchor, agendaDays) };
    if (view === 'week') {
      const from = CalendarModel.mondayOf(anchor);
      return { from, to: ZonedClock.addDays(from, 7) };
    }
    const from = CalendarModel.mondayOf(`${anchor.slice(0, 7)}-01`);
    return { from, to: ZonedClock.addDays(from, MONTH_GRID_DAYS) };
  }

  static daysOf(range: DayRange): LocalDate[] {
    const days: LocalDate[] = [];
    for (let day = range.from; day < range.to; day = ZonedClock.addDays(day, 1)) days.push(day);
    return days;
  }

  static mondayOf(date: LocalDate): LocalDate {
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
    return ZonedClock.addDays(date, -((weekday + 6) % 7));
  }

  /** One page forward (+1) or back (-1). */
  static step(view: CalendarView, anchor: LocalDate, direction: 1 | -1, agendaDays: number): LocalDate {
    if (view === 'week') return ZonedClock.addDays(anchor, 7 * direction);
    if (view === 'list') return ZonedClock.addDays(anchor, agendaDays * direction);
    const [year, month] = anchor.split('-').map(Number);
    const target = new Date(Date.UTC(year, month - 1 + direction, 1));
    return target.toISOString().slice(0, 10);
  }

  static place(entries: readonly CalendarEntry[], date: LocalDate, startHour: number, endHour: number, clock: ZonedClock): PlacedEntry[] {
    const dayStart = Date.parse(clock.toInstant(`${date}T${String(startHour).padStart(2, '0')}:00`));
    const dayEnd = Date.parse(clock.toInstant(`${date}T${String(endHour).padStart(2, '0')}:00`));
    const span = dayEnd - dayStart;
    const items = entries
      .map((entry) => ({ entry, start: Math.max(Date.parse(entry.start), dayStart), end: Math.min(Date.parse(entry.end ?? entry.start), dayEnd) }))
      .filter((i) => i.end > i.start || (i.start >= dayStart && i.start < dayEnd))
      .sort((a, b) => a.start - b.start || b.end - a.end);
    // Greedy lanes: each entry takes the first lane that is free at its start.
    const laneEnds: number[] = [];
    const placed = items.map((i) => {
      let lane = laneEnds.findIndex((end) => end <= i.start);
      if (lane < 0) lane = laneEnds.push(0) - 1;
      laneEnds[lane] = Math.max(i.end, i.start + span / 48);
      return { ...i, lane };
    });
    return placed.map((p) => ({
      entry: p.entry,
      top: ((p.start - dayStart) / span) * 100,
      height: Math.max(((p.end - p.start) / span) * 100, 100 / ((endHour - startHour) * 2)),
      lane: p.lane,
      lanes: laneEnds.length,
    }));
  }

  private enabledSources(): Set<string> {
    return new Set(this.sources.all.map((s) => s.id).filter((id) => this.isShown(id)));
  }

  /** Multi-day entries appear on every club-local day they touch. */
  private bucket(entries: readonly CalendarEntry[]): Map<LocalDate, CalendarEntry[]> {
    const map = new Map<LocalDate, CalendarEntry[]>();
    for (const entry of entries) {
      const first = this.clock.localDate(entry.start);
      const last = entry.end ? this.clock.localDate(new Date(Date.parse(entry.end) - 1)) : first;
      for (let day = first; day <= last; day = ZonedClock.addDays(day, 1)) {
        map.set(day, [...(map.get(day) ?? []), entry]);
      }
    }
    return map;
  }
}
