import { Action } from '../../lib/state/Action.svelte';
import { Resource } from '../../lib/state/Resource.svelte';
import type { CalendarApi } from './CalendarApi';
import type { Appointment, Attendance, AttendanceEntry, ResponseStatus } from './model';

/** One appointment with its attendance, plus the actions taken on the detail page. */
export class AppointmentDetailModel {
  readonly appointment: Resource<Appointment>;
  readonly attendance: Resource<Attendance>;
  readonly respondAction = new Action();
  readonly cancelAction = new Action();

  /** The signed-in member's own entry, if the attendance list contains it. */
  readonly ownEntry: AttendanceEntry | null;

  constructor(
    private readonly api: CalendarApi,
    readonly id: string,
    private readonly memberId: string,
  ) {
    this.appointment = new Resource(() => this.api.get(this.id));
    this.attendance = new Resource(() => this.api.attendance(this.id));
    this.ownEntry = $derived(this.attendance.value?.entries.find((e) => e.memberId === this.memberId) ?? null);
  }

  load(): Promise<unknown> {
    return Promise.all([this.appointment.load(), this.attendance.load()]);
  }

  async respond(status: ResponseStatus, reason: string): Promise<boolean> {
    const ok = await this.respondAction.run(() => this.api.respond(this.id, status, reason.trim() || null));
    if (ok) await this.attendance.load();
    return ok;
  }

  async cancel(includeFollowing: boolean): Promise<boolean> {
    const ok = await this.cancelAction.run(() => this.api.cancel(this.id, includeFollowing));
    if (ok) await this.appointment.load();
    return ok;
  }
}
