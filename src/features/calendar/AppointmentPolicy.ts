import { PlanningPolicy } from '../../lib/policy/PlanningPolicy';
import type { Appointment } from './model';

/**
 * Client-side mirror of the server's calendar rules, used only to show or hide actions; the server
 * decides. Answering for minors is not offered yet.
 */
export class AppointmentPolicy extends PlanningPolicy {
  canEdit(appointment: Appointment): boolean {
    return !appointment.cancelled && this.permissions.canManage(appointment.teamId);
  }

  /** Car pools where the club and the appointment offer them, not for cancelled ones. */
  hasRides(appointment: Appointment): boolean {
    return !appointment.cancelled && appointment.rides && this.session.club?.ridesEnabled !== false;
  }

  isPast(appointment: Appointment, now: Date = new Date()): boolean {
    return new Date(appointment.startsAt) <= now;
  }

  /** Answers are allowed until the appointment starts, for members of its team (any member when club-wide). */
  canRespond(appointment: Appointment, now: Date = new Date()): boolean {
    if (appointment.cancelled || this.isPast(appointment, now)) return false;
    return appointment.teamId === null || this.session.isInTeam(appointment.teamId);
  }
}
