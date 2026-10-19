import { describe, expect, it } from 'vitest';
import { CalendarSources, type CalendarEntry } from '../../lib/calendar/CalendarSources';
import { ZonedClock } from '../../lib/time/ZonedClock';
import { CalendarModel } from './CalendarModel.svelte';
import { EventListModel } from './EventListModel.svelte';

const vienna = new ZonedClock('Europe/Vienna');

const entry = (key: string, start: string, end: string | null, extra: Partial<CalendarEntry> = {}): CalendarEntry => ({
  key, source: 'test', title: key, start, end, allDay: false, hue: 'blue', teamId: null, inactive: false, label: '', window: { kind: 'x', id: key }, ...extra,
});

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
      '2026-10-20', 7, 23, vienna,
    );
    const byKey = Object.fromEntries(placed.map((p) => [p.entry.key, p]));
    expect(byKey.a.top).toBeCloseTo((12 / 16) * 100);
    expect(byKey.a.height).toBeCloseTo((2 / 16) * 100);
    expect([byKey.a.lane, byKey.b.lane, byKey.c.lane]).toEqual([0, 1, 0]);
    expect(byKey.a.lanes).toBe(2);
  });

  it('clips entries to the visible hours', () => {
    const [placed] = CalendarModel.place([entry('late', vienna.toInstant('2026-10-20T22:00'), vienna.toInstant('2026-10-21T01:00'))], '2026-10-20', 7, 23, vienna);
    expect(placed.top + placed.height).toBeCloseTo(100);
  });
});

describe('CalendarModel data', () => {
  it('loads enabled sources, buckets multi-day entries and filters by team', async () => {
    const sources = new CalendarSources()
      .register({ id: 'appointments', label: 'Termine', load: async () => [
        entry('camp', vienna.toInstant('2026-10-16T09:00'), vienna.toInstant('2026-10-18T12:00'), { teamId: 't1' }),
        entry('club', vienna.toInstant('2026-10-16T19:00'), vienna.toInstant('2026-10-16T20:00')),
      ] })
      .register({ id: 'tasks', label: 'Aufgaben', load: async () => [entry('due', vienna.toInstant('2026-10-17T18:00'), null, { allDay: true })] });
    const model = new CalendarModel(sources, vienna, null, { view: 'month', date: '2026-10-15' });
    await model.load();
    expect(model.entriesOn('2026-10-17').map((e) => e.key)).toEqual(['camp', 'due']);
    expect(model.entriesOn('2026-10-18').map((e) => e.key)).toEqual(['camp']);
    model.setTeam('t1');
    expect(model.entriesOn('2026-10-16').map((e) => e.key)).toEqual(['camp']);
    await model.toggleSource('tasks');
    model.setTeam(null);
    expect(model.entriesOn('2026-10-17').map((e) => e.key)).toEqual(['camp']);
  });
});

describe('CalendarModel views', () => {
  it('opens an old list link or preference as month view', () => {
    const sources = new CalendarSources();
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
