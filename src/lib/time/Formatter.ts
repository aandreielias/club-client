import type { LocalDate } from './ZonedClock';

/** Locale- and zone-aware display of API values (UTC instants and plain dates). */
export class Formatter {
  readonly #dateTime: Intl.DateTimeFormat;
  readonly #time: Intl.DateTimeFormat;
  readonly #dayHeading: Intl.DateTimeFormat;
  readonly #plainDate: Intl.DateTimeFormat;
  readonly #number: Intl.NumberFormat;
  readonly #month: Intl.DateTimeFormat;
  readonly #weekday: Intl.DateTimeFormat;
  readonly #shortDate: Intl.DateTimeFormat;

  constructor(
    readonly locale: string,
    readonly timeZone: string,
  ) {
    this.#dateTime = new Intl.DateTimeFormat(locale, { timeZone, dateStyle: 'medium', timeStyle: 'short' });
    this.#time = new Intl.DateTimeFormat(locale, { timeZone, timeStyle: 'short' });
    this.#dayHeading = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
    // Plain dates carry no zone; formatting them in UTC keeps the day unchanged.
    this.#plainDate = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', dateStyle: 'medium' });
    this.#number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
    this.#month = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', month: 'long', year: 'numeric' });
    this.#weekday = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'short' });
    this.#shortDate = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', day: 'numeric', month: 'short' });
  }

  /** e.g. "Oktober 2026" */
  month(date: LocalDate): string {
    return this.#month.format(Formatter.utcDate(date));
  }

  /** e.g. "Mo." */
  weekday(date: LocalDate): string {
    return this.#weekday.format(Formatter.utcDate(date));
  }

  /** e.g. "20. Okt." */
  shortDate(date: LocalDate): string {
    return this.#shortDate.format(Formatter.utcDate(date));
  }

  /** File size, e.g. "2,4 MB" (decimal units, like file managers). */
  bytes(size: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = size;
    let unit = 0;
    while (value >= 1000 && unit < units.length - 1) {
      value /= 1000;
      unit++;
    }
    return `${this.#number.format(value)} ${units[unit]}`;
  }

  dateTime(instant: string): string {
    return this.#dateTime.format(new Date(instant));
  }

  time(instant: string): string {
    return this.#time.format(new Date(instant));
  }

  date(date: LocalDate): string {
    return this.#plainDate.format(Formatter.utcDate(date));
  }

  /** e.g. "Dienstag, 20. Oktober" */
  dayHeading(date: LocalDate): string {
    return this.#dayHeading.format(Formatter.utcDate(date));
  }

  /** "18:00 – 19:30", or with dates when the range spans several days. */
  range(startsAt: string, endsAt: string, sameDay: boolean): string {
    return sameDay ? `${this.time(startsAt)} – ${this.time(endsAt)}` : `${this.dateTime(startsAt)} – ${this.dateTime(endsAt)}`;
  }

  private static utcDate(date: LocalDate): Date {
    return new Date(`${date}T00:00:00Z`);
  }
}
