import type { CalendarEntry, CalendarSources } from '../../lib/calendar/CalendarSources';
import { ZonedClock, type LocalDate } from '../../lib/time/ZonedClock';
import type { EventBus } from '../../lib/bus';
import { APP_ERROR } from '../../lib/errors/ErrorReporter';
import { TOAST } from '../../lib/notify/ToastService.svelte';

/**
 * Moving calendar entries by drag and drop: onto a day (month view, all-day lane: same time of
 * day) or onto a time in a day column (week view, snapped). The duration stays the same.
 */
export class CalendarDrag {
  static readonly TYPE = 'application/x-club-calendar-entry';

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
  }

  /** Drop side: true (and the drop allowed) when an entry is being dragged. */
  over(event: DragEvent): boolean {
    if (!event.dataTransfer?.types.includes(CalendarDrag.TYPE)) return false;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    return true;
  }

  /** Moves the dropped entry to `target(entry)`, confirms it and reloads the calendar. */
  async drop(event: DragEvent, entries: readonly CalendarEntry[], target: (entry: CalendarEntry) => { start: string; end: string | null }, reload: () => void): Promise<void> {
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

  /** New start/end when dropped on `day`, keeping the time of day. */
  toDay(entry: CalendarEntry, day: LocalDate): { start: string; end: string | null } {
    const time = this.clock.toLocal(entry.start).slice(11);
    return this.shifted(entry, this.clock.toInstant(`${day}T${time}`));
  }

  /** New start/end when dropped at `minutes` after midnight of `day` (snapped). */
  toTime(entry: CalendarEntry, day: LocalDate, minutes: number): { start: string; end: string | null } {
    const snapped = Math.max(0, Math.round(minutes / this.snapMinutes) * this.snapMinutes);
    return this.shifted(entry, this.clock.toInstant(ZonedClock.addMinutes(`${day}T00:00`, snapped)));
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
