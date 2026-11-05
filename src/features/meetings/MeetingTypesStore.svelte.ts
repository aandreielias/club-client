import type { EventBus } from '../../lib/bus';
import { CatalogStore } from '../../lib/state/CatalogStore.svelte';
import { MEETING_TYPES_CHANGED } from './events';
import type { MeetingsApi } from './MeetingsApi';
import type { MeetingKind, MeetingType, MeetingTypeInput } from './model';

/** The club's meeting types (server: meetings_type); empty until loaded. */
export class MeetingTypesStore extends CatalogStore<MeetingKind, MeetingType, MeetingTypeInput> {
  constructor(api: MeetingsApi, bus: EventBus) {
    super(() => api.types(), bus, MEETING_TYPES_CHANGED, [], {
      save: (key, input) => api.saveType(key, input),
      delete: (key) => api.deleteType(key),
    });
  }
}
