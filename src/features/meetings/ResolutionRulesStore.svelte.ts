import type { EventBus } from '../../lib/bus';
import { LiveStore } from '../../lib/state/LiveStore.svelte';
import { ACTION_RULES_CHANGED } from './events';
import type { MeetingsApi } from './MeetingsApi';
import { SEEDED_CIRCULAR, type Majority, type ResolutionAction, type ResolutionRules } from './model';

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
