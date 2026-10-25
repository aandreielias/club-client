import { describe, expect, it } from 'vitest';
import { MAX_HOURS, nudge, shortLabel, toFraction, toHours } from './timeline';

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
