import { describe, expect, it } from 'vitest';
import { ZonedClock } from './ZonedClock';

const vienna = new ZonedClock('Europe/Vienna');

describe('ZonedClock', () => {
  it('converts wall-clock time to instants in winter and summer', () => {
    expect(vienna.toInstant('2026-01-15T19:00')).toBe('2026-01-15T18:00:00.000Z');
    expect(vienna.toInstant('2026-07-01T19:00')).toBe('2026-07-01T17:00:00.000Z');
  });

  it('handles the days of the DST switch', () => {
    expect(vienna.toInstant('2026-03-29T03:30')).toBe('2026-03-29T01:30:00.000Z');
    expect(vienna.toInstant('2026-03-28T19:00')).toBe('2026-03-28T18:00:00.000Z');
    expect(vienna.toInstant('2026-10-25T19:00')).toBe('2026-10-25T18:00:00.000Z');
  });

  it('round-trips instants to local time', () => {
    for (const local of ['2026-01-15T19:00', '2026-07-01T00:15', '2026-12-31T23:59']) {
      expect(vienna.toLocal(vienna.toInstant(local))).toBe(local);
    }
    expect(vienna.localDate('2026-06-30T22:30:00Z')).toBe('2026-07-01');
    expect(vienna.startOfDay('2026-07-01')).toBe('2026-06-30T22:00:00.000Z');
  });

  it('does date arithmetic without zone effects', () => {
    expect(ZonedClock.addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(ZonedClock.addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(ZonedClock.addMinutes('2026-12-31T23:30', 90)).toBe('2027-01-01T01:00');
  });
});
