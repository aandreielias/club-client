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
  readonly restoreAction = new Action();
  readonly deleteAction = new Action();
  readonly remindAction = new Action();
  readonly presenceAction = new Action();

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

  /** For oneself, or with `memberId` for one's minor. */
  async respond(status: ResponseStatus, reason: string, memberId: string | null = null): Promise<boolean> {
    const ok = await this.respondAction.run(() =>
      this.api.respond(this.id, status, reason.trim() || null, memberId === this.memberId ? null : memberId),
    );
    if (ok) await this.attendance.load();
    return ok;
  }

  entryOf(memberId: string): AttendanceEntry | null {
    return this.attendance.value?.entries.find((e) => e.memberId === memberId) ?? null;
  }

  async cancel(includeFollowing: boolean, reason: string | null = null): Promise<boolean> {
    const ok = await this.cancelAction.run(() => this.api.cancel(this.id, includeFollowing, reason?.trim() || null));
    if (ok) await this.appointment.load();
    return ok;
  }

  async restore(): Promise<boolean> {
    const ok = await this.restoreAction.run(() => this.api.restore(this.id));
    if (ok) await this.load();
    return ok;
  }

  /** Only while nobody answered. */
  delete(): Promise<boolean> {
    return this.deleteAction.run(() => this.api.delete(this.id));
  }

  /** How many were reminded (0: reminded already, or everyone answered). */
  async remindOpen(): Promise<number | null> {
    let count: number | null = null;
    const ok = await this.remindAction.run(async () => (count = await this.api.remindOpen(this.id)));
    return ok ? count : null;
  }

  async setPresence(memberId: string, present: boolean | null): Promise<boolean> {
    return this.presenceAction.run(async () => {
      const attendance = await this.api.setPresence(this.id, memberId, present);
      this.attendance.set(attendance);
    });
  }
}
