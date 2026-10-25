import type { EventBus } from '../../lib/bus';
import { MEETING_TYPES_CHANGED } from './events';
import type { MeetingsApi } from './MeetingsApi';
import type { MeetingKind, MeetingType } from './model';

/** The club's meeting types (server: meetings_type), loaded at start and reloaded when the club changes them. */
export class MeetingTypes {
  items = $state.raw<MeetingType[]>([]);

  constructor(
    private readonly api: MeetingsApi,
    private readonly bus: EventBus,
  ) {}

  start(): () => void {
    void this.load().catch(() => {});
    return this.bus.subscribe(MEETING_TYPES_CHANGED, () => void this.load().catch(() => {})).unsubscribe;
  }

  async load(): Promise<MeetingType[]> {
    this.items = await this.api.types();
    return this.items;
  }

  get(key: MeetingKind): MeetingType | undefined {
    return this.items.find((t) => t.key === key);
  }

  /** The key until the types are loaded. */
  label(key: MeetingKind): string {
    return this.get(key)?.label ?? key;
  }

  /** Types a new meeting may have. */
  get active(): MeetingType[] {
    return this.items.filter((t) => !t.archived);
  }
}
