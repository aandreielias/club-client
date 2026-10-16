import { Action } from '../../lib/state/Action.svelte';
import { Resource } from '../../lib/state/Resource.svelte';
import type { CalendarApi } from './CalendarApi';
import type { Ride } from './model';

/** Car pools of one appointment and the changes a member makes to them. */
export class RidesModel {
  readonly rides: Resource<Ride[]>;
  readonly action = new Action();

  constructor(
    private readonly api: CalendarApi,
    readonly appointmentId: string,
    private readonly memberId: string,
  ) {
    this.rides = new Resource(() => this.api.rides(this.appointmentId));
  }

  /** The member drives a car of their own. */
  get driving(): boolean {
    return this.rides.value?.some((r) => r.driverId === this.memberId) ?? false;
  }

  static free(ride: Ride): number {
    return ride.seats - ride.passengers.length;
  }

  static has(ride: Ride, memberId: string): boolean {
    return ride.passengers.some((p) => p.memberId === memberId);
  }

  load(): Promise<unknown> {
    return this.rides.load();
  }

  offer(seats: number, note: string): Promise<boolean> {
    return this.run(() => this.api.offerRide(this.appointmentId, seats, note.trim() || null));
  }

  join(rideId: string, memberId: string | null): Promise<boolean> {
    return this.run(() => this.api.joinRide(rideId, memberId));
  }

  leave(rideId: string, memberId: string): Promise<boolean> {
    return this.run(() => this.api.leaveRide(rideId, memberId));
  }

  cancel(rideId: string): Promise<void> {
    return this.api.cancelRide(rideId).then(() => void this.load());
  }

  private async run(call: () => Promise<unknown>): Promise<boolean> {
    const ok = await this.action.run(call);
    if (ok) await this.load();
    return ok;
  }
}
