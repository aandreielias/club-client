import type { EventBus } from '../../lib/bus';
import { LiveStore } from '../../lib/state/LiveStore.svelte';
import { ACTION_RULES_CHANGED } from './events';
import type { MeetingsApi } from './MeetingsApi';
import { ACTION_LABELS, SEEDED_CIRCULAR, type Majority, type ResolutionAction, type ResolutionRules } from './model';

/** The club's resolution rules (server: meetings_action_rule, meetings_setting): fixed majorities, follow-ups, circular votes. */
export class ResolutionRulesStore extends LiveStore<ResolutionRules> {
  constructor(api: MeetingsApi, bus: EventBus) {
    super(() => api.resolutionRules(), bus, ACTION_RULES_CHANGED, { items: [], circular: SEEDED_CIRCULAR });
  }

  /** The majority a decision fixes (seeded: statute change two thirds, dissolution three quarters). */
  fixedMajority(action: ResolutionAction): Majority | null {
    return this.value.items.find((r) => r.action === action)?.majority ?? null;
  }

  /** Not removed by the club (true until loaded). */
  enabled(action: ResolutionAction): boolean {
    return this.value.items.find((r) => r.action === action)?.enabled !== false;
  }

  /** Removed decisions keep their name on passed resolutions, marked. */
  label(action: ResolutionAction): string {
    return this.enabled(action) ? ACTION_LABELS[action] : `${ACTION_LABELS[action]} (entfernt)`;
  }
}
