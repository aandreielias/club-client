import type { CalendarEntry, CalendarSources } from '../../lib/calendar/CalendarSources';
import { ZonedClock, type LocalDate } from '../../lib/time/ZonedClock';
import type { EventBus } from '../../lib/bus';
import { APP_ERROR } from '../../lib/errors/ErrorReporter';
import { TOAST } from '../../lib/notify/ToastService.svelte';

/** Where the pointer is: the day of the cell or column under it, and the minutes after midnight in a week column. */
export interface PointerSpot {
  day: LocalDate;
  minutes: number | null;
}

export type ResizeEdge = 'start' | 'end';
/** `days`: month view and all-day lane change whole days; `time`: the week grid changes the time (snapped). */
export type ResizeMode = 'days' | 'time';

/**
 * Moving calendar entries by drag and drop: onto a day (month view, all-day lane: same time of
 * day) or onto a time in a day column (week view, snapped). The span stays the same, measured from where the entry was
 * grabbed: a three-day bar taken at its second day and dropped on Friday runs Thursday to Saturday.
 * Resizing pulls an edge (see `resized`).
 */
export class CalendarDrag {
  static readonly TYPE = 'application/x-club-calendar-entry';

  /** Days between the entry's first day and the grabbed day; minutes between its start and the grabbed time (week grid). */
  #grabDays = 0;
  #grabMinutes = 0;

  constructor(
    private readonly sources: CalendarSources,
    private readonly clock: ZonedClock,
    private readonly snapMinutes: number,
    private readonly bus?: EventBus,
  ) {}

  /** Chip side: offer the entry for dragging. */
  start(entry: CalendarEntry, event: DragEvent): void {
    if (!this.canMove(entry) || !event.dataTransfer) return;
    event.dataTransfer.setData(CalendarDrag.TYPE, entry.key);
    event.dataTransfer.effectAllowed = 'move';
    const spot = CalendarDrag.spotAt(event.clientX, event.clientY);
    this.grab(entry, spot);
  }

  /** Remembers where the entry was taken (tests call it directly). */
  grab(entry: CalendarEntry, spot: PointerSpot | null): void {
    const first = this.clock.localDate(entry.start);
    this.#grabDays = spot && spot.day > first ? CalendarDrag.daysBetween(first, spot.day) : 0;
    const startMinutes = CalendarDrag.minutesOf(this.clock.toLocal(entry.start));
    this.#grabMinutes = spot?.minutes != null && spot.day === first ? Math.max(0, spot.minutes - startMinutes) : 0;
  }

  /** The cell or week column under a point (bars lie above the cells, so the whole stack is searched). */
  static spotAt(x: number, y: number): PointerSpot | null {
    if (typeof document === 'undefined' || !document.elementsFromPoint) return null;
    for (const element of document.elementsFromPoint(x, y)) {
      if (!(element instanceof HTMLElement) || !element.dataset.day) continue;
      const { day, startHour, endHour } = element.dataset;
      if (startHour === undefined || endHour === undefined) return { day, minutes: null };
      const box = element.getBoundingClientRect();
      const share = Math.min(Math.max((y - box.top) / box.height, 0), 1);
      return { day, minutes: Number(startHour) * 60 + share * (Number(endHour) - Number(startHour)) * 60 };
    }
    return null;
  }

  /** Drop side: true (and the drop allowed) when an entry is being dragged. */
  over(event: DragEvent): boolean {
    if (!event.dataTransfer?.types.includes(CalendarDrag.TYPE)) return false;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    return true;
  }

  /** Moves the dropped entry to `target(entry)`, confirms it and reloads the calendar. */
  async drop(
    event: DragEvent,
    entries: readonly CalendarEntry[],
    target: (entry: CalendarEntry) => { start: string; end: string | null },
    reload: () => void,
  ): Promise<void> {
    event.preventDefault();
    const entry = entries.find((e) => e.key === event.dataTransfer?.getData(CalendarDrag.TYPE));
    if (!entry) return;
    try {
      if (await this.move(entry, target(entry))) {
        this.bus?.publish(TOAST, { text: `„${entry.title}“ verschoben.` });
        reload();
      }
    } catch (error) {
      this.bus?.publish(APP_ERROR, error);
    }
  }

  canMove(entry: CalendarEntry): boolean {
    return this.sources.canMove(entry);
  }

  /** New start/end when dropped on `day` (the grabbed day lands there), keeping the time of day. */
  toDay(entry: CalendarEntry, day: LocalDate): { start: string; end: string | null } {
    const time = this.clock.toLocal(entry.start).slice(11);
    return this.shifted(entry, this.clock.toInstant(`${ZonedClock.addDays(day, -this.#grabDays)}T${time}`));
  }

  /** New start/end when dropped at `minutes` after midnight of `day` (the grabbed time lands there, snapped). */
  toTime(entry: CalendarEntry, day: LocalDate, minutes: number): { start: string; end: string | null } {
    const snapped = Math.max(0, Math.round((minutes - this.#grabMinutes) / this.snapMinutes) * this.snapMinutes);
    return this.shifted(entry, this.clock.toInstant(ZonedClock.addMinutes(`${day}T00:00`, snapped)));
  }

  canResize(entry: CalendarEntry): boolean {
    return this.sources.canResize(entry);
  }

  /**
   * The entry with one edge pulled to `spot`. Days: all-day entries end at the start of the day after the last day, timed ones keep
   * their times of day. Time: snapped minutes; at least one snap long. Null when nothing would change or the spot is unusable.
   */
  resized(entry: CalendarEntry, edge: ResizeEdge, mode: ResizeMode, spot: PointerSpot): { start: string; end: string } | null {
    if (!entry.end) return null;
    if (mode === 'time') {
      if (spot.minutes == null) return null;
      const snapped = Math.round(spot.minutes / this.snapMinutes) * this.snapMinutes;
      const at = this.clock.toInstant(ZonedClock.addMinutes(`${spot.day}T00:00`, snapped));
      const min = this.snapMinutes * 60_000;
      if (edge === 'end') {
        const end = Date.parse(at) < Date.parse(entry.start) + min ? new Date(Date.parse(entry.start) + min).toISOString() : at;
        return end === entry.end ? null : { start: entry.start, end };
      }
      const start = Date.parse(at) > Date.parse(entry.end) - min ? new Date(Date.parse(entry.end) - min).toISOString() : at;
      return start === entry.start ? null : { start, end: entry.end };
    }
    const first = this.clock.localDate(entry.start);
    const last = this.clock.localDate(new Date(Date.parse(entry.end) - 1));
    if (edge === 'end') {
      const day = spot.day < first ? first : spot.day;
      const end = entry.allDay
        ? this.clock.startOfDay(ZonedClock.addDays(day, 1))
        : this.clock.toInstant(`${day}T${this.clock.toLocal(entry.end).slice(11)}`);
      if (Date.parse(end) <= Date.parse(entry.start)) return null;
      return end === entry.end ? null : { start: entry.start, end };
    }
    const day = spot.day > last ? last : spot.day;
    const start = this.clock.toInstant(`${day}T${this.clock.toLocal(entry.start).slice(11)}`);
    if (Date.parse(start) >= Date.parse(entry.end)) return null;
    return start === entry.start ? null : { start, end: entry.end };
  }

  static daysBetween(from: LocalDate, to: LocalDate): number {
    return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
  }

  private static minutesOf(local: string): number {
    return Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16));
  }

  async move(entry: CalendarEntry, target: { start: string; end: string | null }): Promise<boolean> {
    if (target.start === entry.start) return false;
    await this.sources.move(entry, target.start, target.end);
    return true;
  }

  private shifted(entry: CalendarEntry, start: string): { start: string; end: string | null } {
    const delta = Date.parse(start) - Date.parse(entry.start);
    return { start, end: entry.end ? new Date(Date.parse(entry.end) + delta).toISOString() : null };
  }
}
