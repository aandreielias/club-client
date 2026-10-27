import { describe, expect, it } from 'vitest';
import { CalendarSources, type CalendarEntry, type CalendarItem } from '../../lib/calendar/CalendarSources';
import type { ApiClient } from '../../lib/http/ApiClient';
import { ZonedClock } from '../../lib/time/ZonedClock';
import { CalendarModel } from './CalendarModel.svelte';
import { EventListModel } from './EventListModel.svelte';

const vienna = new ZonedClock('Europe/Vienna');

const entry = (key: string, start: string, end: string | null, extra: Partial<CalendarEntry> = {}): CalendarEntry => ({
  key,
  source: 'APPOINTMENT',
  title: key,
  start,
  end,
  allDay: false,
  hue: 'blue',
  teamId: null,
  inactive: false,
  label: '',
  window: { kind: 'x', id: key },
  path: null,
  item: { kind: 'x', id: key },
  movable: false,
  resizable: false,
  ...extra,
});

const item = (
  id: string,
  category: CalendarItem['category'],
  start: string,
  end: string | null,
  extra: Partial<CalendarItem> = {},
): CalendarItem => ({
  kind: 'appointment',
  id,
  title: id,
  start,
  end,
  allDay: false,
  category,
  teamId: null,
  inactive: false,
  detail: null,
  movable: false,
  resizable: false,
  ...extra,
});

const api = (items: CalendarItem[]) => ({ get: async () => ({ items }) }) as unknown as ApiClient;

describe('CalendarModel ranges', () => {
  it('builds a Monday-first six-week month grid', () => {
    const range = CalendarModel.rangeOf('month', '2026-10-15');
    expect(range).toEqual({ from: '2026-09-28', to: '2026-11-09' });
    expect(CalendarModel.daysOf(range)).toHaveLength(42);
  });

  it('builds weeks', () => {
    expect(CalendarModel.rangeOf('week', '2026-10-18')).toEqual({ from: '2026-10-12', to: '2026-10-19' }); // Sunday → Monday before
  });

  it('steps by month and week', () => {
    expect(CalendarModel.step('month', '2026-01-31', 1)).toBe('2026-02-01');
    expect(CalendarModel.step('month', '2026-01-15', -1)).toBe('2025-12-01');
    expect(CalendarModel.step('week', '2026-10-15', -1)).toBe('2026-10-08');
  });
});

describe('CalendarModel week layout', () => {
  it('positions entries by club time and puts overlaps side by side', () => {
    const placed = CalendarModel.place(
      [
        entry('a', vienna.toInstant('2026-10-20T19:00'), vienna.toInstant('2026-10-20T21:00')),
        entry('b', vienna.toInstant('2026-10-20T20:00'), vienna.toInstant('2026-10-20T22:00')),
        entry('c', vienna.toInstant('2026-10-20T21:00'), vienna.toInstant('2026-10-20T22:00')),
      ],
      '2026-10-20',
      7,
      23,
      vienna,
    );
    const byKey = Object.fromEntries(placed.map((p) => [p.entry.key, p]));
    expect(byKey.a.top).toBeCloseTo((12 / 16) * 100);
    expect(byKey.a.height).toBeCloseTo((2 / 16) * 100);
    expect([byKey.a.lane, byKey.b.lane, byKey.c.lane]).toEqual([0, 1, 0]);
    expect(byKey.a.lanes).toBe(2);
  });

  it('clips entries to the visible hours', () => {
    const [placed] = CalendarModel.place(
      [entry('late', vienna.toInstant('2026-10-20T22:00'), vienna.toInstant('2026-10-21T01:00'))],
      '2026-10-20',
      7,
      23,
      vienna,
    );
    expect(placed.top + placed.height).toBeCloseTo(100);
  });
});

describe('CalendarModel data', () => {
  it('loads every category, buckets multi-day entries and filters by category and team', async () => {
    const sources = new CalendarSources(
      api([
        item('camp', 'APPOINTMENT', vienna.toInstant('2026-10-16T09:00'), vienna.toInstant('2026-10-18T12:00'), { teamId: 't1' }),
        item('club', 'APPOINTMENT', vienna.toInstant('2026-10-16T19:00'), vienna.toInstant('2026-10-16T20:00')),
        item('due', 'TASK', vienna.toInstant('2026-10-17T18:00'), null, { allDay: true, kind: 'task' }),
      ]),
    ).style('APPOINTMENT', () => ({ label: 'Training' }));
    const model = new CalendarModel(sources, vienna, null, { view: 'month', date: '2026-10-15' });
    await model.load();
    const titles = (day: string) => model.entriesOn(day).map((e) => e.title);
    expect(titles('2026-10-17')).toEqual(['camp', 'due']);
    expect(titles('2026-10-18')).toEqual(['camp']);
    expect(model.entriesOn('2026-10-18')[0]).toMatchObject({ label: 'Training', hue: 'blue', window: { kind: 'appointment', id: 'camp' } });
    model.setTeam('t1');
    expect(titles('2026-10-16')).toEqual(['camp']);
    model.toggleSource('TASK');
    model.setTeam(null);
    expect(titles('2026-10-17')).toEqual(['camp']);
    expect(model.countOf('TASK')).toBe(1);
    model.showAll();
    expect(titles('2026-10-17')).toEqual(['camp', 'due']);
  });
});

describe('CalendarModel views', () => {
  it('opens an old list link or preference as month view', () => {
    const sources = new CalendarSources(api([]));
    const model = new CalendarModel(sources, new ZonedClock('Europe/Vienna'), null, { view: 'list' as never, date: '2026-10-15' });
    expect(model.view).toBe('month');
  });
});

describe('EventListModel', () => {
  it('loads the coming year, or the past one', () => {
    expect(EventListModel.range('2026-10-19', false)).toEqual({ from: '2026-10-19', to: '2027-10-19' });
    expect(EventListModel.range('2026-10-19', true)).toEqual({ from: '2025-10-19', to: '2026-10-19' });
  });
});

describe('CalendarModel spans', () => {
  const week = CalendarModel.daysOf({ from: '2026-10-19', to: '2026-10-26' });

  it('draws entries across several days as one bar per week, in lanes', () => {
    const vote = entry('vote', '2026-10-20T08:00:00Z', '2026-10-24T18:00:00Z'); // Tue–Sat
    const cup = entry('cup', vienna.startOfDay('2026-10-17'), vienna.startOfDay('2026-10-22'), { allDay: true }); // Sat (before) – Wed
    const short = entry('short', '2026-10-21T16:00:00Z', '2026-10-21T18:00:00Z');
    expect(CalendarModel.multiDay(short, vienna)).toBe(false);
    expect(CalendarModel.multiDay(cup, vienna)).toBe(true);
    const { spans, lanes } = CalendarModel.layoutSpans([vote, cup], week, vienna);
    expect(lanes).toBe(2);
    expect(spans.find((s) => s.entry.key === 'cup')).toMatchObject({ from: 0, to: 2, lane: 0, before: true, after: false });
    expect(spans.find((s) => s.entry.key === 'vote')).toMatchObject({ from: 1, to: 5, lane: 1, before: false, after: false });
  });

  it('reuses a lane once the bar before it ended', () => {
    const a = entry('a', vienna.startOfDay('2026-10-19'), vienna.startOfDay('2026-10-21'), { allDay: true }); // Mon–Tue
    const b = entry('b', vienna.startOfDay('2026-10-22'), vienna.startOfDay('2026-10-28'), { allDay: true }); // Thu – next Tue
    const { spans, lanes } = CalendarModel.layoutSpans([a, b], week, vienna);
    expect(lanes).toBe(1);
    expect(spans.find((s) => s.entry.key === 'b')).toMatchObject({ from: 3, to: 6, lane: 0, after: true });
  });
});
