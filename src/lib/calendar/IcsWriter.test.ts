import { describe, expect, it } from 'vitest';
import { IcsWriter } from './IcsWriter';

describe('IcsWriter', () => {
  const writer = new IcsWriter('-//club//DE', 'Verein, Termine');

  it('writes events with escaped text, UTC times and CRLF', () => {
    const ics = writer.write(
      [
        {
          uid: 'a1@club',
          start: '2026-10-20T16:00:00Z',
          end: '2026-10-20T17:30:00Z',
          summary: 'Training; Halle 1',
          location: 'Halle, Süd',
          cancelled: true,
        },
      ],
      new Date('2026-10-16T08:00:00Z'),
    );
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics).toContain('X-WR-CALNAME:Verein\\, Termine\r\n');
    expect(ics).toContain('DTSTART:20261020T160000Z\r\nDTEND:20261020T173000Z\r\n');
    expect(ics).toContain('SUMMARY:Training\\; Halle 1\r\n');
    expect(ics).toContain('LOCATION:Halle\\, Süd\r\n');
    expect(ics).toContain('STATUS:CANCELLED\r\n');
    expect(ics).toContain('DTSTAMP:20261016T080000Z');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('folds long lines at 75 octets without splitting characters', () => {
    const folded = IcsWriter.fold(`DESCRIPTION:${'ä'.repeat(80)}`);
    const lines = folded.split('\r\n');
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(lines.slice(1).every((l) => l.startsWith(' '))).toBe(true);
    expect(folded.replace(/\r\n /g, '')).toBe(`DESCRIPTION:${'ä'.repeat(80)}`);
  });
});
