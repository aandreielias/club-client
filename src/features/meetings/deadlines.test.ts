import { describe, expect, it } from 'vitest';
import type { CalendarEntry } from '../../lib/calendar/CalendarSources';
import { ZonedClock } from '../../lib/time/ZonedClock';
import { DeadlineListModel } from './DeadlineListModel.svelte';

const clock = new ZonedClock('Europe/Vienna');
const entry = (extra: Partial<CalendarEntry>): CalendarEntry => ({
  key: 'k', source: 'MEETING', title: 't', start: '2026-10-23T16:00:00Z', end: '2026-10-23T18:00:00Z', allDay: false, hue: 'purple', teamId: null,
  inactive: false, label: 'Vorstandssitzung', window: { kind: 'meeting', id: 'm' }, path: null, item: { kind: 'meeting', id: 'm' }, movable: false, resizable: false, ...extra,
});

describe('DeadlineListModel', () => {
  it('loads three years ahead in server-sized chunks, or the last year', () => {
    expect(DeadlineListModel.chunks('2026-10-23', false)).toEqual([
      ['2026-10-23', '2027-10-23'], ['2027-10-23', '2028-10-22'], ['2028-10-22', '2029-10-22'],
    ]);
    expect(DeadlineListModel.chunks('2026-10-23', true)).toEqual([['2025-10-23', '2026-10-23']]);
  });

  it('shows the date that counts as TT.MM.JJJJ', () => {
    expect(DeadlineListModel.when(entry({}), clock)).toBe('23.10.2026 18:00');
    // A circular vote counts by its deadline.
    expect(DeadlineListModel.when(entry({ source: 'DEADLINE', start: '2026-10-20T08:00:00Z', end: '2026-10-27T10:00:00Z' }), clock)).toBe('27.10.2026 11:00');
    // All-day items start at club midnight.
    expect(DeadlineListModel.when(entry({ source: 'OFFICE', allDay: true, start: '2027-03-31T22:00:00Z', end: null }), clock)).toBe('01.04.2027');
  });
});
