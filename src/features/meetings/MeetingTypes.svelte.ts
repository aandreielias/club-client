import type { EventBus } from '../../lib/bus';
import { ACTION_RULES_CHANGED, MEETING_TYPES_CHANGED } from './events';
import type { MeetingsApi } from './MeetingsApi';
import type { ActionRule, Majority, MeetingKind, MeetingType, ResolutionAction } from './model';

/** The club's meeting types and resolution rules (server: meetings_type, meetings_action_rule), loaded at start and on changes. */
export class MeetingTypes {
  items = $state.raw<MeetingType[]>([]);
  rules = $state.raw<ActionRule[]>([]);

  constructor(
    private readonly api: MeetingsApi,
    private readonly bus: EventBus,
  ) {}

  start(): () => void {
    void this.load().catch(() => {});
    void this.loadRules().catch(() => {});
    const types = this.bus.subscribe(MEETING_TYPES_CHANGED, () => void this.load().catch(() => {}));
    const rules = this.bus.subscribe(ACTION_RULES_CHANGED, () => void this.loadRules().catch(() => {}));
    return () => (types.unsubscribe(), rules.unsubscribe());
  }

  async loadRules(): Promise<ActionRule[]> {
    this.rules = await this.api.resolutionRules();
    return this.rules;
  }

  /** The majority a decision fixes (seeded: statute change two thirds, dissolution three quarters). */
  fixedMajority(action: ResolutionAction): Majority | null {
    return this.rules.find((r) => r.action === action)?.majority ?? null;
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
