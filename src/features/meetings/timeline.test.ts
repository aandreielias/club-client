import { describe, expect, it } from 'vitest';
import { fromAmount, MAX_HOURS, nudge, shortLabel, toAmount, toFraction, toHours } from './timeline';

describe('timeline scale', () => {
  it('maps hours to a log axis and back, snapped to hours or days', () => {
    expect(toFraction(0)).toBe(0);
    expect(toFraction(MAX_HOURS)).toBe(1);
    expect(toFraction(10_000)).toBe(1);
    expect(toFraction(24)).toBeGreaterThan(0.4); // a day sits near the middle, not at the edge
    for (const hours of [0, 1, 5, 24, 47, 72, 336, 1440]) expect(toHours(toFraction(hours))).toBe(hours);
    expect(toHours(toFraction(100))).toBe(96);
  });

  it('nudges by an hour under two days, a day above, a week with Shift', () => {
    expect(nudge(24, 1)).toBe(25);
    expect(nudge(47, 1)).toBe(48);
    expect(nudge(48, 1)).toBe(72);
    expect(nudge(48, -1)).toBe(47);
    expect(nudge(72, -1)).toBe(48);
    expect(nudge(0, -1)).toBe(0);
    expect(nudge(72, 1, true)).toBe(240);
    expect([shortLabel(3), shortLabel(72), shortLabel(336), shortLabel(168)]).toEqual(['3 Std.', '3 Tage', '2 Wochen', '1 Woche']);
  });
});

describe('step dialog amounts', () => {
  it('shows whole days in days and the rest in hours', () => {
    expect(toAmount(72)).toEqual({ amount: 3, unit: 'days' });
    expect(toAmount(0)).toEqual({ amount: 0, unit: 'days' });
    expect(toAmount(30)).toEqual({ amount: 30, unit: 'hours' });
  });

  it('turns days and hours back into whole hours within a year', () => {
    expect(fromAmount(3, 'days')).toBe(72);
    expect(fromAmount(5, 'hours')).toBe(5);
    expect(fromAmount(1.5, 'days')).toBe(36);
    expect(fromAmount(-2, 'hours')).toBe(0);
    expect(fromAmount(400, 'days')).toBe(8760);
    expect(fromAmount(Number.NaN, 'days')).toBe(0);
  });
});
