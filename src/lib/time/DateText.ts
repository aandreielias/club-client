import { ZonedClock, type LocalDate } from './ZonedClock';

/** Typed dates in the German form TT.MM.JJJJ, and the day grid of the date picker. */
export class DateText {
  /** '2026-10-23' → '23.10.2026'; '' stays ''. */
  static format(date: LocalDate | ''): string {
    const [y, m, d] = date.split('-');
    return date ? `${d}.${m}.${y}` : '';
  }

  /** 'T.M.JJJJ', 'TT.MM.JJJJ' or 'TTMMJJJJ' → ISO date; null when incomplete or no real day. */
  static parse(text: string): LocalDate | null {
    const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(text.trim()) ?? /^(\d{2})(\d{2})(\d{4})$/.exec(text.trim());
    if (!match) return null;
    const [d, m, y] = match.slice(1).map(Number);
    const date = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    // Date.UTC rolls 31.02. over to March; a real day survives the round trip.
    return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) === date ? date : null;
  }

  /** 'HH:MM' (also 'H:MM', 'HHMM') → 'HH:MM'; null otherwise. */
  static parseTime(text: string): string | null {
    const match = /^(\d{1,2}):?(\d{2})$/.exec(text.trim());
    if (!match) return null;
    const [h, m] = [Number(match[1]), Number(match[2])];
    return h < 24 && m < 60 ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` : null;
  }

  /** First of the month of `date`. */
  static monthStart(date: LocalDate): LocalDate {
    return `${date.slice(0, 7)}-01`;
  }

  /** Same day `months` later, clamped to the month's last day (31.01. + 1 → 28./29.02.). */
  static addMonths(date: LocalDate, months: number): LocalDate {
    const [y, m, d] = date.split('-').map(Number);
    const last = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y, m - 1 + months, Math.min(d, last))).toISOString().slice(0, 10);
  }

  /** Six Monday-first weeks covering the month of `date`. */
  static monthGrid(date: LocalDate): LocalDate[] {
    const first = DateText.monthStart(date);
    const weekday = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
    const start = ZonedClock.addDays(first, -weekday);
    return Array.from({ length: 42 }, (_, i) => ZonedClock.addDays(start, i));
  }
}
