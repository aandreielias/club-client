import type { CalendarEntry, CalendarSources } from '../../lib/calendar/CalendarSources';
import { Resource } from '../../lib/state/Resource.svelte';
import type { LocalStore } from '../../lib/storage/LocalStore';
import { ZonedClock, type LocalDate } from '../../lib/time/ZonedClock';

export type CalendarView = 'month' | 'week';

export const CALENDAR_VIEWS: readonly { value: CalendarView; label: string }[] = [
  { value: 'month', label: 'Monat' },
  { value: 'week', label: 'Woche' },
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
const HIDDEN_KEY = 'calendar.hidden-categories';

/**
 * The calendar page: one view (month or week) around an anchor date, entries of all
 * registered sources for the visible range, filtered by source and team. Days are club-local.
 */
/** A multi-day entry within one week: columns `from`..`to`, its lane, and whether it runs on before/after the week. */
export interface Span {
  entry: CalendarEntry;
  from: number;
  to: number;
  lane: number;
  before: boolean;
  after: boolean;
}

export class CalendarModel {
  view = $state<CalendarView>('month');
  anchor = $state<LocalDate>('');
  teamId = $state<string | null>(null);
  hidden = $state<string[]>([]);
  /** An entry being resized: shown with this range until saved or dropped. */
  preview = $state<{ key: string; start: string; end: string } | null>(null);

  readonly entries: Resource<CalendarEntry[]>;
  readonly range: DayRange;
  readonly days: LocalDate[];
  /** Entries of the range for the chosen team, every category (for the filter counts). */
  readonly inTeam: CalendarEntry[];
  readonly visible: CalendarEntry[];
  readonly byDay: Map<LocalDate, CalendarEntry[]>;

  constructor(
    private readonly sources: CalendarSources,
    private readonly clock: ZonedClock,
    private readonly store: LocalStore | null,
    initial: Partial<CalendarPosition> = {},
  ) {
    this.view = initial.view && ['month', 'week'].includes(initial.view) ? initial.view : 'month';
    this.anchor = initial.date && /^\d{4}-\d{2}-\d{2}$/.test(initial.date) ? initial.date : clock.today();
    this.teamId = initial.teamId ?? null;
    this.hidden = store?.get<string[]>(HIDDEN_KEY) ?? [];
    this.range = $derived(CalendarModel.rangeOf(this.view, this.anchor));
    this.days = $derived(CalendarModel.daysOf(this.range));
    this.entries = new Resource(() => this.sources.load(this.clock.startOfDay(this.range.from), this.clock.startOfDay(this.range.to)));
    this.inTeam = $derived(
      (this.entries.value ?? [])
        .map((e) => (this.preview?.key === e.key ? { ...e, start: this.preview.start, end: this.preview.end } : e))
        .filter((e) => !this.teamId || e.teamId === this.teamId),
    );
    this.visible = $derived(this.inTeam.filter((e) => this.isShown(e.source)));
    this.byDay = $derived(this.bucket(this.visible));
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
    return this.goTo(CalendarModel.step(this.view, this.anchor, 1));
  }

  previous(): Promise<void> {
    return this.goTo(CalendarModel.step(this.view, this.anchor, -1));
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

  /** Categories filter on the client: switching them needs no reload. */
  toggleSource(sourceId: string): void {
    this.hidden = this.isShown(sourceId) ? [...this.hidden, sourceId] : this.hidden.filter((id) => id !== sourceId);
    this.store?.set(HIDDEN_KEY, this.hidden);
  }

  showAll(): void {
    this.hidden = [];
    this.store?.set(HIDDEN_KEY, this.hidden);
  }

  /** How many entries of a category the range has (for the chosen team). */
  countOf(sourceId: string): number {
    return this.inTeam.filter((e) => e.source === sourceId).length;
  }

  entriesOn(date: LocalDate): CalendarEntry[] {
    return this.byDay.get(date) ?? [];
  }

  /** True for days of the anchor's month (month view greys out the others). */
  inAnchorMonth(date: LocalDate): boolean {
    return date.slice(0, 7) === this.anchor.slice(0, 7);
  }

  /** Entries of one day that do not run across several days (those are bars, see `spans`). */
  singleOn(date: LocalDate): CalendarEntry[] {
    return this.entriesOn(date).filter((e) => !CalendarModel.multiDay(e, this.clock));
  }

  /** Entries running across several days within `days` (one week), as bars in lanes. */
  spans(days: readonly LocalDate[]): { spans: Span[]; lanes: number } {
    return CalendarModel.layoutSpans(
      this.visible.filter((e) => CalendarModel.multiDay(e, this.clock)),
      days,
      this.clock,
    );
  }

  /** Timed single-day entries of one day placed on the week grid between `startHour` and `endHour`. */
  placeOn(date: LocalDate, startHour: number, endHour: number): PlacedEntry[] {
    const timed = this.singleOn(date).filter((e) => !e.allDay && e.end);
    return CalendarModel.place(timed, date, startHour, endHour, this.clock);
  }

  // ---- pure helpers (unit-tested) ----

  /** First and last club-local day an entry touches. */
  static spanOf(entry: CalendarEntry, clock: ZonedClock): [LocalDate, LocalDate] {
    const first = clock.localDate(entry.start);
    const last = entry.end ? clock.localDate(new Date(Date.parse(entry.end) - 1)) : first;
    return [first, last < first ? first : last];
  }

  static multiDay(entry: CalendarEntry, clock: ZonedClock): boolean {
    const [first, last] = CalendarModel.spanOf(entry, clock);
    return last > first;
  }

  /** Bars for one week: columns 0..6, greedy lanes, and whether a bar runs on before or after this week. */
  static layoutSpans(entries: readonly CalendarEntry[], days: readonly LocalDate[], clock: ZonedClock): { spans: Span[]; lanes: number } {
    const weekStart = days[0];
    const weekEnd = days[days.length - 1];
    const items = entries
      .map((entry) => ({ entry, days: CalendarModel.spanOf(entry, clock) }))
      .filter((i) => i.days[0] <= weekEnd && i.days[1] >= weekStart)
      .sort((a, b) => a.days[0].localeCompare(b.days[0]) || b.days[1].localeCompare(a.days[1]) || a.entry.title.localeCompare(b.entry.title));
    const laneEnds: number[] = [];
    const spans = items.map(({ entry, days: [first, last] }) => {
      const from = first < weekStart ? 0 : days.indexOf(first);
      const to = last > weekEnd ? days.length - 1 : days.indexOf(last);
      let lane = laneEnds.findIndex((end) => end < from);
      if (lane < 0) lane = laneEnds.push(-1) - 1;
      laneEnds[lane] = to;
      return { entry, from, to, lane, before: first < weekStart, after: last > weekEnd };
    });
    return { spans, lanes: laneEnds.length };
  }

  static rangeOf(view: CalendarView, anchor: LocalDate): DayRange {
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
  static step(view: CalendarView, anchor: LocalDate, direction: 1 | -1): LocalDate {
    if (view === 'week') return ZonedClock.addDays(anchor, 7 * direction);
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

  /** Multi-day entries appear on every club-local day they touch (the views draw them as one bar). */
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
