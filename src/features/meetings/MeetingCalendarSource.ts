import type { CalendarEntry, CalendarSource } from '../../lib/calendar/CalendarSources';
import type { MeetingPolicy } from './MeetingPolicy';
import type { MeetingsApi } from './MeetingsApi';
import { isAssembly, latestInvite, type MeetingSummary, type Resolution } from './model';

/**
 * Meetings in the calendar, and for admin and board also the deadlines around them: the last day to invite to a draft meeting, and
 * circular votes as one bar from opening to their deadline. Each list answers with its own visibility rules.
 */
export class MeetingCalendarSource implements CalendarSource {
  readonly id = 'meetings';
  readonly label = 'Sitzungen';

  constructor(
    private readonly api: MeetingsApi,
    private readonly policy: MeetingPolicy,
  ) {}

  async load(from: string, to: string): Promise<CalendarEntry[]> {
    const board = this.policy.canCreate();
    const [meetings, drafts, circular] = await Promise.all([
      this.api.list(from, to),
      // A draft's invitation deadline lies up to 14 days before the meeting.
      board ? this.api.list(from, new Date(Date.parse(to) + 15 * 86_400_000).toISOString()) : Promise.resolve([]),
      board ? this.api.circular() : Promise.resolve([]),
    ]);
    return [
      ...meetings.map(MeetingCalendarSource.entry),
      ...drafts.filter((m) => m.status === 'DRAFT').map(MeetingCalendarSource.inviteBy).filter((e) => e.start >= from && e.start < to),
      ...circular.filter((r) => r.status === 'OPEN' && r.deadline && r.openedAt && r.openedAt < to && r.deadline > from).map(MeetingCalendarSource.circularVote),
    ];
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

  /** The last moment the invitation keeps the notice period (server: MeetingRules.latestInvite). */
  static inviteBy(meeting: MeetingSummary): CalendarEntry {
    return {
      key: `meeting-invite:${meeting.id}`,
      source: 'meetings',
      title: `Einladen: ${meeting.title}`,
      start: latestInvite(meeting.kind, meeting.startsAt),
      end: null,
      allDay: true,
      hue: 'orange',
      teamId: null,
      inactive: false,
      label: 'Einladungsfrist',
      window: { kind: 'meeting', id: meeting.id },
    };
  }

  static circularVote(r: Resolution): CalendarEntry {
    return {
      key: `circular:${r.id}`,
      source: 'meetings',
      title: `Umlaufbeschluss: ${r.title}`,
      start: r.openedAt!,
      end: r.deadline,
      allDay: false,
      hue: 'purple',
      teamId: null,
      inactive: r.voted,
      label: r.voted ? 'Umlaufbeschluss (abgestimmt)' : 'Umlaufbeschluss offen',
      window: { kind: 'resolution', id: r.id },
    };
  }
}
