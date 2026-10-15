/** 'YYYY-MM-DD' */
export type LocalDate = string;
/** 'YYYY-MM-DDTHH:mm', wall-clock time in the clock's zone (same shape as <input type="datetime-local">). */
export type LocalDateTime = string;

/**
 * Converts between UTC instants (API) and wall-clock time in one IANA zone (the club's), independent
 * of the browser's zone. DST gaps resolve to the later offset.
 */
export class ZonedClock {
  readonly #parts: Intl.DateTimeFormat;

  constructor(readonly timeZone: string) {
    this.#parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  toLocal(instant: string | Date): LocalDateTime {
    const f = this.fields(new Date(instant).getTime());
    return `${f.year}-${f.month}-${f.day}T${f.hour}:${f.minute}`;
  }

  localDate(instant: string | Date): LocalDate {
    return this.toLocal(instant).slice(0, 10);
  }

  today(now: Date = new Date()): LocalDate {
    return this.localDate(now);
  }

  /** Wall-clock time in this zone → ISO instant (UTC). */
  toInstant(local: LocalDateTime | LocalDate): string {
    const [date, time = '00:00'] = local.split('T');
    const [y, m, d] = date.split('-').map(Number);
    const [h, min] = time.split(':').map(Number);
    const wall = Date.UTC(y, m - 1, d, h, min);
    // Two passes: the first offset guess can be off by one DST shift.
    const guess = wall - this.offsetMs(wall);
    return new Date(wall - this.offsetMs(guess)).toISOString();
  }

  /** First instant of the given day in this zone. */
  startOfDay(date: LocalDate): string {
    return this.toInstant(`${date}T00:00`);
  }

  static addDays(date: LocalDate, days: number): LocalDate {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
  }

  static addMinutes(local: LocalDateTime, minutes: number): LocalDateTime {
    const [date, time] = local.split('T');
    const [y, m, d] = date.split('-').map(Number);
    const [h, min] = time.split(':').map(Number);
    return new Date(Date.UTC(y, m - 1, d, h, min + minutes)).toISOString().slice(0, 16);
  }

  /** Zone offset at the given instant, in ms (UTC+2 → 7 200 000). */
  private offsetMs(epochMs: number): number {
    const seconds = Math.floor(epochMs / 1000) * 1000;
    const f = this.fields(seconds);
    return Date.UTC(+f.year, +f.month - 1, +f.day, +f.hour, +f.minute, +f.second) - seconds;
  }

  private fields(epochMs: number): Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', string> {
    const out = { year: '', month: '', day: '', hour: '', minute: '', second: '' };
    for (const part of this.#parts.formatToParts(epochMs)) {
      if (part.type in out) out[part.type as keyof typeof out] = part.value;
    }
    return out;
  }
}
