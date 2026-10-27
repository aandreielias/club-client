import { describe, expect, it } from 'vitest';
import { CalendarSources, type CalendarEntry } from '../../lib/calendar/CalendarSources';
import type { ApiClient } from '../../lib/http/ApiClient';
import { ZonedClock } from '../../lib/time/ZonedClock';
import { CalendarDrag } from './CalendarDrag';

const entry: CalendarEntry = {
  key: 'appointment:a',
  source: 'APPOINTMENT',
  title: 'Training',
  start: '2026-10-20T17:00:00.000Z',
  end: '2026-10-20T18:30:00.000Z',
  allDay: false,
  hue: 'blue',
  teamId: null,
  inactive: false,
  label: 'Training',
  window: { kind: 'appointment', id: 'a' },
  path: null,
  item: { kind: 'appointment', id: 'a' },
  movable: true,
  resizable: true,
};

describe('CalendarDrag', () => {
  const drag = new CalendarDrag(new CalendarSources({} as ApiClient), new ZonedClock('Europe/Vienna'), 15);

  it('keeps the time of day and the duration when dropped on another day', () => {
    expect(drag.toDay(entry, '2026-10-22')).toEqual({ start: '2026-10-22T17:00:00.000Z', end: '2026-10-22T18:30:00.000Z' });
    // Across the switch to winter time (25 Oct) the local time stays 19:00.
    expect(drag.toDay(entry, '2026-10-27').start).toBe('2026-10-27T18:00:00.000Z');
  });

  it('snaps a dropped time to the grid', () => {
    expect(drag.toTime(entry, '2026-10-21', 18 * 60 + 7)).toEqual({ start: '2026-10-21T16:00:00.000Z', end: '2026-10-21T17:30:00.000Z' });
  });
});

describe('CalendarDrag spans', () => {
  const clock = new ZonedClock('Europe/Vienna');
  const drag = new CalendarDrag(new CalendarSources({} as ApiClient), clock, 15);
  // Wed 21 – Fri 23 Oct, all day
  const camp: CalendarEntry = { ...entry, key: 'camp', allDay: true, start: clock.startOfDay('2026-10-21'), end: clock.startOfDay('2026-10-24') };

  it('keeps the span from where the bar was grabbed', () => {
    drag.grab(camp, { day: '2026-10-22', minutes: null }); // its second day
    expect(drag.toDay(camp, '2026-10-30')).toEqual({ start: clock.startOfDay('2026-10-29'), end: clock.startOfDay('2026-11-01') });
    drag.grab(entry, { day: '2026-10-20', minutes: 19 * 60 + 30 }); // half an hour into the 19:00 training
    expect(drag.toTime(entry, '2026-10-21', 20 * 60 + 30).start).toBe('2026-10-21T18:00:00.000Z'); // starts 20:00 local
  });

  it('pulls whole days at the edges of all-day and timed entries', () => {
    expect(drag.resized(camp, 'end', 'days', { day: '2026-10-25', minutes: null })).toEqual({
      start: camp.start,
      end: clock.startOfDay('2026-10-26'),
    });
    expect(drag.resized(camp, 'start', 'days', { day: '2026-10-19', minutes: null })).toEqual({
      start: clock.startOfDay('2026-10-19'),
      end: camp.end,
    });
    // never before its own start / after its own end
    expect(drag.resized(camp, 'end', 'days', { day: '2026-10-10', minutes: null })).toEqual({
      start: camp.start,
      end: clock.startOfDay('2026-10-22'),
    });
    expect(drag.resized(entry, 'end', 'days', { day: '2026-10-22', minutes: null })).toEqual({ start: entry.start, end: '2026-10-22T18:30:00.000Z' });
  });

  it('pulls the time in the week grid, snapped and at least one snap long', () => {
    expect(drag.resized(entry, 'end', 'time', { day: '2026-10-20', minutes: 21 * 60 + 7 })).toEqual({
      start: entry.start,
      end: '2026-10-20T19:00:00.000Z',
    });
    expect(drag.resized(entry, 'start', 'time', { day: '2026-10-20', minutes: 21 * 60 })).toEqual({
      start: '2026-10-20T18:15:00.000Z',
      end: entry.end,
    });
    expect(drag.resized(entry, 'end', 'time', { day: '2026-10-20', minutes: 20 * 60 + 30 })).toBeNull(); // unchanged
  });
});
