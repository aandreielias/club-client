import { describe, expect, it, vi } from 'vitest';
import type { CalendarApi } from './CalendarApi';
import { CalendarExport } from './CalendarExport';
import type { Appointment } from './model';

const appointment = (id: string, startsAt: string): Appointment => ({
  id, seriesId: null, teamId: null, type: 'TRAINING', title: `Training ${id}`, description: null, location: 'Halle 1',
  startsAt, endsAt: startsAt.replace('T16', 'T18'), cancelled: false,
});

describe('CalendarExport', () => {
  it('reads the future in server-sized chunks and drops duplicates', async () => {
    const a = appointment('a', '2026-10-20T16:00:00Z');
    const b = appointment('b', '2027-03-01T16:00:00Z');
    const list = vi.fn(async (from: string) => (from.startsWith('2026') ? [b, a] : [b]));
    const exporter = new CalendarExport({ list } as unknown as CalendarApi, { maxRangeDays: 366, exportDays: 731 });
    const result = await exporter.appointments(new Date('2026-10-16T00:00:00Z'));
    expect(list).toHaveBeenCalledTimes(2);
    expect(list.mock.calls[0]).toEqual(['2026-10-16T00:00:00.000Z', '2027-10-17T00:00:00.000Z', null]);
    expect(result.map((x) => x.id)).toEqual(['a', 'b']);
    const ics = exporter.ics(result, 'Soli Deo Gloria', new Date('2026-10-16T00:00:00Z'));
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain('CATEGORIES:Training');
  });

  it('builds a file name from the club name', () => {
    expect(CalendarExport.fileName('Soli Deo Gloria')).toBe('soli-deo-gloria-termine.ics');
  });
});
