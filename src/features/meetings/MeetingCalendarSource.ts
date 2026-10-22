import type { CalendarEntry, CalendarSource } from '../../lib/calendar/CalendarSources';
import type { MeetingsApi } from './MeetingsApi';
import { isAssembly, type MeetingSummary } from './model';

/** Puts the visible meetings into the calendar; their time is fixed by the invitation, so they are never dragged. */
export class MeetingCalendarSource implements CalendarSource {
  readonly id = 'meetings';
  readonly label = 'Sitzungen';

  constructor(private readonly api: MeetingsApi) {}

  async load(from: string, to: string): Promise<CalendarEntry[]> {
    return (await this.api.list(from, to)).map(MeetingCalendarSource.entry);
  }

  static entry(meeting: MeetingSummary): CalendarEntry {
    return {
      key: `meeting:${meeting.id}`,
      source: 'meetings',
      title: meeting.title,
      start: meeting.startsAt,
      end: meeting.endsAt,
      allDay: false,
      hue: isAssembly(meeting.kind) ? 'blue' : 'purple',
      teamId: null,
      inactive: meeting.status === 'CLOSED',
      label: isAssembly(meeting.kind) ? 'Mitgliederversammlung' : 'Vorstandssitzung',
      window: { kind: 'meeting', id: meeting.id },
    };
  }
}
