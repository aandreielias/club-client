import type { EventBus } from '../../lib/bus';
import { LiveStore } from '../../lib/state/LiveStore.svelte';
import { MEETING_TYPES_CHANGED } from './events';
import type { MeetingsApi } from './MeetingsApi';
import type { MeetingKind, MeetingType } from './model';

/** The club's meeting types (server: meetings_type); empty until loaded. */
export class MeetingTypesStore extends LiveStore<readonly MeetingType[]> {
  constructor(api: MeetingsApi, bus: EventBus) {
    super(() => api.types(), bus, MEETING_TYPES_CHANGED, []);
  }

  get items(): readonly MeetingType[] {
    return this.value;
  }

  get(key: MeetingKind): MeetingType | undefined {
    return this.value.find((t) => t.key === key);
  }

  /** The key until the types are loaded. */
  /** Archived ones keep their name on what used them, marked; new records cannot choose them. */
  label(key: MeetingKind): string {
    const found = this.get(key);
    return found ? (found.archived ? `${found.label} (archiviert)` : found.label) : key;
  }
}
