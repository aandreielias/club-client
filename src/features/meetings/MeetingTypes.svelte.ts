import type { EventBus } from '../../lib/bus';
import { LiveStore } from '../../lib/state/LiveStore.svelte';
import { ACTION_RULES_CHANGED, MEETING_TYPES_CHANGED } from './events';
import type { MeetingsApi } from './MeetingsApi';
import { SEEDED_CIRCULAR, type Majority, type MeetingKind, type MeetingType, type ResolutionAction, type ResolutionRules } from './model';

/** The club's meeting types (server: meetings_type); empty until loaded. */
export class MeetingTypes extends LiveStore<readonly MeetingType[]> {
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
  label(key: MeetingKind): string {
    return this.get(key)?.label ?? key;
  }
}

/** The club's resolution rules (server: meetings_action_rule, meetings_setting): fixed majorities, follow-ups, circular votes. */
export class ResolutionRulesStore extends LiveStore<ResolutionRules> {
  constructor(api: MeetingsApi, bus: EventBus) {
    super(() => api.resolutionRules(), bus, ACTION_RULES_CHANGED, { items: [], circular: SEEDED_CIRCULAR });
  }

  /** The majority a decision fixes (seeded: statute change two thirds, dissolution three quarters). */
  fixedMajority(action: ResolutionAction): Majority | null {
    return this.value.items.find((r) => r.action === action)?.majority ?? null;
  }
}
