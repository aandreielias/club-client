import type { Hue } from '../types';
import type { WindowTarget } from '../window/WindowService.svelte';

/** One item in the calendar, independent of the feature that provides it. */
export interface CalendarEntry {
  /** Unique across sources, e.g. 'appointment:a-1'. */
  key: string;
  /** Source id, used by the source filter. */
  source: string;
  title: string;
  /** UTC instants. */
  start: string;
  /** null = a point in time (e.g. a due date). */
  end: string | null;
  /** Shown in the all-day lane of the week view (due dates) instead of on the time grid. */
  allDay: boolean;
  hue: Hue;
  teamId: string | null;
  /** Struck through (cancelled appointments, done tasks). */
  inactive: boolean;
  /** Short extra text, e.g. the type or "Fällig". */
  label: string;
  /** What opens on click. */
  window: WindowTarget;
}

/** A feature that puts entries into the calendar (features never import each other). */
export interface CalendarSource {
  id: string;
  label: string;
  load(from: string, to: string): Promise<CalendarEntry[]>;
}

/** Registry of all calendar sources; loads and merges the enabled ones for a time range. */
export class CalendarSources {
  readonly #sources: CalendarSource[] = [];

  register(source: CalendarSource): this {
    if (this.#sources.some((s) => s.id === source.id)) throw new Error(`Calendar source "${source.id}" registered twice`);
    this.#sources.push(source);
    return this;
  }

  get all(): readonly CalendarSource[] {
    return this.#sources;
  }

  /** Entries overlapping [from, to) of the enabled sources (all when `enabled` is omitted), sorted by start. */
  async load(from: string, to: string, enabled?: ReadonlySet<string>): Promise<CalendarEntry[]> {
    const active = this.#sources.filter((s) => !enabled || enabled.has(s.id));
    const lists = await Promise.all(active.map((s) => s.load(from, to)));
    return lists.flat().sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
  }
}
