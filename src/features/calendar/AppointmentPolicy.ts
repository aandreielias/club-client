import { PlanningPolicy } from '../../lib/policy/PlanningPolicy';
import type { Appointment, Attendance } from './model';

/**
 * Client-side mirror of the server's calendar rules, used only to show or hide actions; the server
 * decides. Guardians answer for their minors in the team.
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

  /** Answers are allowed until the appointment starts, for members of its team (any member when club-wide) and their guardians. */
  canRespond(appointment: Appointment, now: Date = new Date()): boolean {
    if (appointment.cancelled || this.isPast(appointment, now)) return false;
    return appointment.teamId === null || this.session.isInTeam(appointment.teamId) || this.session.wardIds.length > 0;
  }

  /** server: AttendanceAccess.selfOrWard — oneself and one's minors, as far as they belong to the appointment's team (its attendance list). */
  respondents(appointment: Appointment, attendance: Attendance | null): { id: string; name: string }[] {
    if (!this.canRespond(appointment)) return [];
    const listed = (id: string) => appointment.teamId === null || !!attendance?.entries.some((e) => e.memberId === id);
    const self = this.session.member;
    const out = listed(self.id) || (appointment.teamId !== null && this.session.isInTeam(appointment.teamId)) ? [{ id: self.id, name: 'Ich' }] : [];
    for (const ward of this.session.wardIds) {
      if (listed(ward))
        out.push({ id: ward, name: attendance?.entries.find((e) => e.memberId === ward)?.name ?? this.session.me?.wardNames[ward] ?? 'Kind' });
    }
    return out;
  }

  /** Coaches of the team, admin and board: remind, mark presence, see the team's statistics (server: AttendanceHandlers.requireRunsTeam). */
  runsTeam(appointment: Appointment): boolean {
    return this.permissions.isManager || (appointment.teamId !== null && this.permissions.canManage(appointment.teamId));
  }

  /** Taken back by who may edit it (server: CalendarHandlers.restore). */
  canRestore(appointment: Appointment): boolean {
    return appointment.cancelled && this.permissions.canManage(appointment.teamId);
  }
}
