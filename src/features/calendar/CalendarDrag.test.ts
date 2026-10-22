import { describe, expect, it } from 'vitest';
import { CalendarSources, type CalendarEntry } from '../../lib/calendar/CalendarSources';
import type { ApiClient } from '../../lib/http/ApiClient';
import { ZonedClock } from '../../lib/time/ZonedClock';
import { CalendarDrag } from './CalendarDrag';

const entry: CalendarEntry = {
  key: 'appointment:a', source: 'APPOINTMENT', title: 'Training', start: '2026-10-20T17:00:00.000Z', end: '2026-10-20T18:30:00.000Z',
  allDay: false, hue: 'blue', teamId: null, inactive: false, label: 'Training', window: { kind: 'appointment', id: 'a' }, path: null,
  item: { kind: 'appointment', id: 'a' }, movable: true, resizable: true,
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
