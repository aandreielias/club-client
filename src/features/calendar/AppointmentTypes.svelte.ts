import type { EventBus } from '../../lib/bus';
import { liveEvent } from '../../lib/live/LiveUpdates.svelte';
import type { Hue } from '../../lib/types';
import type { CalendarApi } from './CalendarApi';
import { SEEDED_APPOINTMENT_TYPES, type AppointmentType, type AppointmentTypeInfo } from './model';

export const APPOINTMENT_TYPES_CHANGED = liveEvent<Record<string, never>>('calendar.appointment-types-changed');

/** The club's appointment types (server: calendar_type), loaded at start and reloaded when the club changes them. */
export class AppointmentTypes {
  items = $state.raw<readonly AppointmentTypeInfo[]>(SEEDED_APPOINTMENT_TYPES);

  constructor(
    private readonly api: CalendarApi,
    private readonly bus: EventBus,
  ) {}

  start(): () => void {
    void this.load().catch(() => {});
    return this.bus.subscribe(APPOINTMENT_TYPES_CHANGED, () => void this.load().catch(() => {})).unsubscribe;
  }

  async load(): Promise<readonly AppointmentTypeInfo[]> {
    this.items = await this.api.types();
    return this.items;
  }

  get(key: AppointmentType): AppointmentTypeInfo | undefined {
    return this.items.find((t) => t.key === key);
  }

  label(key: AppointmentType): string {
    return this.get(key)?.label ?? key;
  }

  hue(key: AppointmentType): Hue {
    return this.get(key)?.hue ?? 'gray';
  }

  cabins(key: AppointmentType): boolean {
    return this.get(key)?.cabins ?? false;
  }

  rides(key: AppointmentType): boolean {
    return this.get(key)?.rides ?? false;
  }

  /** For pickers of new or edited appointments; `current` stays offered even when archived. */
  options(current?: AppointmentType): { value: AppointmentType; label: string }[] {
    return this.items.filter((t) => !t.archived || t.key === current).map((t) => ({ value: t.key, label: t.label }));
  }
}
