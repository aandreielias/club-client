import { describe, expect, it } from 'vitest';
import { DateText } from './DateText';

describe('DateText', () => {
  it('formats and parses TT.MM.JJJJ', () => {
    expect(DateText.format('2026-10-03')).toBe('03.10.2026');
    expect(DateText.format('')).toBe('');
    expect(DateText.parse('3.10.2026')).toBe('2026-10-03');
    expect(DateText.parse(' 03.10.2026 ')).toBe('2026-10-03');
    expect(DateText.parse('03102026')).toBe('2026-10-03');
    expect(DateText.parse('31.02.2026')).toBeNull();
    expect(DateText.parse('29.02.2028')).toBe('2028-02-29');
    expect(DateText.parse('03.10.26')).toBeNull();
    expect(DateText.parse('2026-10-03')).toBeNull();
  });

  it('parses 24-hour times', () => {
    expect(DateText.parseTime('9:05')).toBe('09:05');
    expect(DateText.parseTime('1830')).toBe('18:30');
    expect(DateText.parseTime('24:00')).toBeNull();
    expect(DateText.parseTime('12:60')).toBeNull();
  });

  it('moves by months and lays out Monday-first weeks', () => {
    expect(DateText.addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(DateText.addMonths('2028-02-29', -12)).toBe('2027-02-28');
    const grid = DateText.monthGrid('2026-10-23');
    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe('2026-09-28'); // the Monday before 1 Oct (a Thursday)
    expect(grid[3]).toBe('2026-10-01');
  });
});
