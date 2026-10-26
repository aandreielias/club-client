import type { EventBus } from '../../lib/bus';
import { liveEvent } from '../../lib/live/LiveUpdates.svelte';
import { LiveStore } from '../../lib/state/LiveStore.svelte';
import type { Hue } from '../../lib/types';
import type { CalendarApi } from './CalendarApi';
import { SEEDED_APPOINTMENT_TYPES, type AppointmentType, type AppointmentTypeInfo } from './model';

export const APPOINTMENT_TYPES_CHANGED = liveEvent<Record<string, never>>('calendar.appointment-types-changed');

/** The club's appointment types (server: calendar_type); the seeded ones until loaded. */
export class AppointmentTypes extends LiveStore<readonly AppointmentTypeInfo[]> {
  constructor(api: CalendarApi, bus: EventBus) {
    super(() => api.types(), bus, APPOINTMENT_TYPES_CHANGED, SEEDED_APPOINTMENT_TYPES);
  }

  get items(): readonly AppointmentTypeInfo[] {
    return this.value;
  }

  get(key: AppointmentType): AppointmentTypeInfo | undefined {
    return this.value.find((t) => t.key === key);
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
    return this.value.filter((t) => !t.archived || t.key === current).map((t) => ({ value: t.key, label: t.label }));
  }
}
