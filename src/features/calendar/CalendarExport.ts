import { IcsWriter, type IcsEvent } from '../../lib/calendar/IcsWriter';
import type { CalendarApi } from './CalendarApi';
import { SEEDED_APPOINTMENT_TYPES, type Appointment } from './model';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ExportLimits {
  /** server: largest range one list request may ask for. */
  maxRangeDays: number;
  /** How far ahead the export looks. */
  exportDays: number;
}

/**
 * All upcoming appointments the member may see, as an .ics file. Reads the calendar in chunks of
 * the server's maximum range; cancelled ones stay in, marked cancelled, so apps remove them.
 */
export class CalendarExport {
  constructor(
    private readonly api: CalendarApi,
    private readonly limits: ExportLimits,
    /** The club's name for a type (default: the seeded ones). */
    private readonly typeLabel: (type: string) => string = (type) => SEEDED_APPOINTMENT_TYPES.find((t) => t.key === type)?.label ?? type,
  ) {}

  async appointments(now: Date = new Date()): Promise<Appointment[]> {
    const ranges: [string, string][] = [];
    for (let offset = 0; offset < this.limits.exportDays; offset += this.limits.maxRangeDays) {
      const from = new Date(now.getTime() + offset * DAY_MS);
      const to = new Date(now.getTime() + Math.min(offset + this.limits.maxRangeDays, this.limits.exportDays) * DAY_MS);
      ranges.push([from.toISOString(), to.toISOString()]);
    }
    const chunks = await Promise.all(ranges.map(([from, to]) => this.api.list(from, to, null)));
    // An appointment overlapping two ranges comes back twice.
    const unique = new Map(chunks.flat().map((a) => [a.id, a] as const));
    return [...unique.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  ics(appointments: readonly Appointment[], clubName: string, now: Date = new Date()): string {
    const events = appointments.map((a): IcsEvent => ({
      uid: `${a.id}@club-calendar`,
      start: a.startsAt,
      end: a.endsAt,
      summary: a.title,
      description: a.description,
      location: a.location,
      categories: [this.typeLabel(a.type)],
      cancelled: a.cancelled,
    }));
    return new IcsWriter('-//club-client//Kalender//DE', `${clubName} – Termine`).write(events, now);
  }

  /** File name like "soli-deo-gloria-termine.ics". */
  static fileName(clubName: string): string {
    const slug = clubName
      .toLocaleLowerCase('de')
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/[\s_]+/g, '-');
    return `${slug || 'verein'}-termine.ics`;
  }
}
