/** One VEVENT; times are ISO instants (written as UTC). */
export interface IcsEvent {
  uid: string;
  start: string;
  end: string;
  summary: string;
  description?: string | null;
  location?: string | null;
  categories?: readonly string[];
  cancelled?: boolean;
}

/**
 * Writes an iCalendar file (RFC 5545): escaped text, UTC times, CRLF line ends and lines folded at
 * 75 octets. Any calendar app imports the result.
 */
export class IcsWriter {
  constructor(
    private readonly productId: string,
    private readonly calendarName: string,
  ) {}

  write(events: readonly IcsEvent[], now: Date = new Date()): string {
    const stamp = IcsWriter.time(now.toISOString());
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      `PRODID:${this.productId}`,
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${IcsWriter.escape(this.calendarName)}`,
      ...events.flatMap((event) => [
        'BEGIN:VEVENT',
        `UID:${event.uid}`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${IcsWriter.time(event.start)}`,
        `DTEND:${IcsWriter.time(event.end)}`,
        `SUMMARY:${IcsWriter.escape(event.summary)}`,
        ...(event.description ? [`DESCRIPTION:${IcsWriter.escape(event.description)}`] : []),
        ...(event.location ? [`LOCATION:${IcsWriter.escape(event.location)}`] : []),
        ...(event.categories?.length ? [`CATEGORIES:${event.categories.map(IcsWriter.escape).join(',')}`] : []),
        `STATUS:${event.cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
        'END:VEVENT',
      ]),
      'END:VCALENDAR',
    ];
    return lines.map(IcsWriter.fold).join('\r\n') + '\r\n';
  }

  static escape(text: string): string {
    return text.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  }

  /** 2026-10-16T18:00:00.000Z → 20261016T180000Z */
  static time(iso: string): string {
    return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  /** Splits after 75 UTF-8 octets; continuation lines start with a space (never inside a character). */
  static fold(line: string): string {
    const encoder = new TextEncoder();
    const parts: string[] = [];
    let current = '';
    let octets = 0;
    for (const char of line) {
      const size = encoder.encode(char).length;
      const limit = parts.length ? 74 : 75; // the leading space counts on continuation lines
      if (octets + size > limit) {
        parts.push(current);
        current = '';
        octets = 0;
      }
      current += char;
      octets += size;
    }
    parts.push(current);
    return parts.join('\r\n ');
  }
}
