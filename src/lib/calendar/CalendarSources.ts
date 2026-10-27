import type { ApiClient } from '../http/ApiClient';
import type { Hue } from '../types';
import type { WindowTarget } from '../window/WindowService.svelte';
import { CATEGORIES, categoryInfo, type CalendarCategory, type CategoryInfo } from './categories';

/** One calendar item as the server sends it (server: platform.CalendarItems.CalendarItem). */
export interface CalendarItem {
  kind: string;
  id: string;
  title: string;
  start: string;
  end: string | null;
  allDay: boolean;
  category: CalendarCategory;
  teamId: string | null;
  inactive: boolean;
  /** Appointment type, task status, meeting kind, deadline kind, age, absence reason (for who may see it). */
  detail: string | null;
  movable: boolean;
  resizable: boolean;
}

/** One item in the calendar views. */
export interface CalendarEntry {
  /** Unique, e.g. 'APPOINTMENT:a-1'. */
  key: string;
  /** Category, used by the filter. */
  source: CalendarCategory;
  title: string;
  /** UTC instants. */
  start: string;
  /** null = a point in time (e.g. a due date); all-day entries end at the start of the day after their last day. */
  end: string | null;
  allDay: boolean;
  hue: Hue;
  teamId: string | null;
  /** Struck through (cancelled appointments, done tasks, closed meetings). */
  inactive: boolean;
  /** Short extra text, e.g. the type or "Fällig". */
  label: string;
  /** What opens on click: a window, or a page when the record has none (absences, offices). */
  window: WindowTarget | null;
  path: string | null;
  /** What the server moves. */
  item: { kind: string; id: string };
  movable: boolean;
  resizable: boolean;
}

/** A feature's look of its items: hue and label from the item's detail (e.g. appointment type). */
export type CalendarStyle = (item: CalendarItem) => Partial<Pick<CalendarEntry, 'hue' | 'label' | 'title'>>;

/** Kinds without a window: offices go to their page, absences open nothing (they say all there is). */
const PAGES: Readonly<Record<string, string | null>> = { absence: null, office: '/board' };

/**
 * The calendar's one source: everything with a date the member sees, collected by the server from every module
 * (GET /api/v1/calendar/items). Features only style their categories.
 */
export class CalendarSources {
  readonly #styles = new Map<CalendarCategory, CalendarStyle>();

  constructor(private readonly api: ApiClient) {}

  style(category: CalendarCategory, style: CalendarStyle): this {
    this.#styles.set(category, style);
    return this;
  }

  /** Filter groups. */
  get all(): readonly CategoryInfo[] {
    return CATEGORIES;
  }

  canMove(entry: CalendarEntry): boolean {
    return entry.movable;
  }

  canResize(entry: CalendarEntry): boolean {
    return entry.resizable;
  }

  /** Saves the new time (moved or resized); the server checks rights and rules. */
  async move(entry: CalendarEntry, start: string, end: string | null): Promise<void> {
    if (!entry.movable && !entry.resizable) throw new Error('Dieser Eintrag lässt sich nicht verschieben.');
    await this.api.put(`/api/v1/calendar/items/${encodeURIComponent(entry.item.kind)}/${encodeURIComponent(entry.item.id)}`, { start, end });
  }

  /** Entries overlapping [from, to) of the enabled categories (all when `enabled` is omitted), sorted by start. */
  async load(from: string, to: string, enabled?: ReadonlySet<string>): Promise<CalendarEntry[]> {
    const items = (await this.api.get<{ items: CalendarItem[] }>('/api/v1/calendar/items', { from, to })).items;
    return items
      .filter((i) => !enabled || enabled.has(i.category))
      .map((i) => this.entry(i))
      .sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
  }

  entry(item: CalendarItem): CalendarEntry {
    const info = categoryInfo(item.category);
    const page = item.kind in PAGES ? PAGES[item.kind] : undefined;
    return {
      key: `${item.category}:${item.kind}:${item.id}:${item.start}`,
      source: item.category,
      title: item.title,
      start: item.start,
      end: item.end,
      allDay: item.allDay,
      hue: info.hue,
      teamId: item.teamId,
      inactive: item.inactive,
      label: info.label,
      window: page === undefined ? { kind: item.kind, id: item.id } : null,
      path: page ?? null,
      item: { kind: item.kind, id: item.id },
      movable: item.movable,
      resizable: item.resizable,
      ...this.#styles.get(item.category)?.(item),
    };
  }
}
