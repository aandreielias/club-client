import type { CalendarEntry, CalendarSource } from '../../lib/calendar/CalendarSources';
import type { CalendarApi } from './CalendarApi';
import { typeHue, typeLabel, type Appointment } from './model';

/** Puts the member's visible appointments (incl. cancelled ones, struck through) into the calendar. */
export class AppointmentCalendarSource implements CalendarSource {
  readonly id = 'appointments';
  readonly label = 'Termine';

  constructor(
    private readonly api: CalendarApi,
    /** Edit right for a team (null = club-wide). */
    private readonly mayEdit: (teamId: string | null) => boolean = () => false,
  ) {}

  canMove(entry: CalendarEntry): boolean {
    return !entry.inactive && this.mayEdit(entry.teamId);
  }

  /** One occurrence moves; the rest of a series stays. */
  async move(entry: CalendarEntry, start: string, end: string | null): Promise<void> {
    await this.api.update(entry.window.id, { startsAt: start, endsAt: end ?? start });
  }

  async load(from: string, to: string): Promise<CalendarEntry[]> {
    return (await this.api.list(from, to, null)).map(AppointmentCalendarSource.entry);
  }

  static entry(appointment: Appointment): CalendarEntry {
    return {
      key: `appointment:${appointment.id}`,
      source: 'appointments',
      title: appointment.title,
      start: appointment.startsAt,
      end: appointment.endsAt,
      allDay: false,
      hue: typeHue(appointment.type),
      teamId: appointment.teamId,
      inactive: appointment.cancelled,
      label: appointment.cancelled ? 'Abgesagt' : typeLabel(appointment.type),
      window: { kind: 'appointment', id: appointment.id },
    };
  }
}
