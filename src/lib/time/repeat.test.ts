import { describe, expect, it } from 'vitest';
import { repeatAt } from './repeat';

describe('repeatAt', () => {
  it('steps weeks, months and years like the server', () => {
    expect(repeatAt('2026-03-25T18:00', { weeks: 2, months: 0, byWeekday: false }, 1)).toBe('2026-04-08T18:00');
    expect(repeatAt('2026-01-31T09:00', { weeks: 0, months: 1, byWeekday: false }, 1)).toBe('2026-02-28T09:00');
    expect(repeatAt('2026-01-31T09:00', { weeks: 0, months: 1, byWeekday: false }, 2)).toBe('2026-03-31T09:00');
    expect(repeatAt('2026-02-10T09:00', { weeks: 0, months: 12, byWeekday: false }, 1)).toBe('2027-02-10T09:00');
  });

  it('keeps the nth weekday, a fifth one becomes the last', () => {
    // 2026-01-13 is the 2nd Tuesday; February's is the 10th
    expect(repeatAt('2026-01-13T19:00', { weeks: 0, months: 1, byWeekday: true }, 1)).toBe('2026-02-10T19:00');
    // 2026-01-29 is the 5th Thursday; February's last is the 26th
    expect(repeatAt('2026-01-29T19:00', { weeks: 0, months: 1, byWeekday: true }, 1)).toBe('2026-02-26T19:00');
    expect(repeatAt('2026-11-20T19:00', { weeks: 0, months: 1, byWeekday: true }, 2)).toBe('2027-01-15T19:00');
  });
});
