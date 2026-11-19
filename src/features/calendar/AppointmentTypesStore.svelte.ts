import type { EventBus } from '../../lib/bus';
import { liveEvent } from '../../lib/live/LiveUpdates.svelte';
import { CatalogStore } from '../../lib/state/CatalogStore.svelte';
import type { Hue } from '../../lib/types';
import type { CalendarApi } from './CalendarApi';
import { type AppointmentType, type AppointmentTypeInfo, type AppointmentTypeInput } from './model';

const APPOINTMENT_TYPES_CHANGED = liveEvent<Record<string, never>>('calendar.appointment-types-changed');

/** The club's appointment types (server: calendar_type); empty until loaded, never the seeded ones (the club may have changed them). */
export class AppointmentTypesStore extends CatalogStore<AppointmentType, AppointmentTypeInfo, AppointmentTypeInput> {
  constructor(api: CalendarApi, bus: EventBus) {
    super(() => api.types(), bus, APPOINTMENT_TYPES_CHANGED, [], {
      save: (key, input) => api.saveType(key, input),
      delete: (key) => api.deleteType(key),
    });
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
}
