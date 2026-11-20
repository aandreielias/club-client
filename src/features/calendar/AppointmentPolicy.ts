import { PlanningPolicy } from '../../lib/policy/PlanningPolicy';
import { isChosen } from '../../lib/reach';
import type { Appointment, Attendance } from './model';

/**
 * Client-side mirror of the server's calendar rules, used only to show or hide actions; the server
 * decides. Guardians answer for their minors in the team.
 */
export class AppointmentPolicy extends PlanningPolicy {
  canEdit(appointment: Appointment): boolean {
    return !appointment.cancelled && this.manages(appointment);
  }

  /** For chosen people and groups: the board and coaches (server: CalendarHandlers.mayEdit). */
  canCreateForChosen(): boolean {
    return this.permissions.isManager || this.permissions.isCoach;
  }

  /** The board; coaches of the team; a coach the appointment for chosen people they made. */
  private manages(appointment: Appointment): boolean {
    if (this.permissions.canManage(appointment.teamId)) return true;
    return (
      appointment.teamId === null && isChosen(appointment.audience) && this.permissions.isCoach && appointment.createdBy === this.session.member.id
    );
  }

  /** Car pools where the club and the appointment offer them, not for cancelled ones. */
  hasRides(appointment: Appointment): boolean {
    return !appointment.cancelled && appointment.rides;
  }

  isPast(appointment: Appointment, now: Date = new Date()): boolean {
    return new Date(appointment.startsAt) <= now;
  }

  /** Answers close `deadlineHours` before the start (the type's answer deadline). */
  answersClosed(appointment: Appointment, deadlineHours: number, now: Date = new Date()): boolean {
    return new Date(appointment.startsAt).getTime() - deadlineHours * 3_600_000 <= now.getTime();
  }

  /** Answers are allowed until the type's deadline, for members of its team (any member when club-wide) and their guardians. */
  canRespond(appointment: Appointment, now: Date = new Date(), deadlineHours = 0): boolean {
    if (appointment.cancelled || this.answersClosed(appointment, deadlineHours, now)) return false;
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
    return this.manages(appointment);
  }

  /** Taken back by who may edit it (server: CalendarHandlers.restore). */
  canRestore(appointment: Appointment): boolean {
    return appointment.cancelled && this.manages(appointment);
  }
}
