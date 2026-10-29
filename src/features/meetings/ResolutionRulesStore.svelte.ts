import type { EventBus } from '../../lib/bus';
import { LiveStore } from '../../lib/state/LiveStore.svelte';
import { ACTION_RULES_CHANGED } from './events';
import type { MeetingsApi } from './MeetingsApi';
import {
  actionLabel,
  actions,
  allActions,
  SEEDED_CIRCULAR,
  type ActionRule,
  type Majority,
  type MeetingType,
  type ResolutionAction,
  type ResolutionRules,
} from './model';

/** The club's resolution rules (server: meetings_action_rule, meetings_setting): fixed majorities, follow-ups, circular votes. */
export class ResolutionRulesStore extends LiveStore<ResolutionRules> {
  constructor(api: MeetingsApi, bus: EventBus) {
    super(() => api.resolutionRules(), bus, ACTION_RULES_CHANGED, { items: [], circular: SEEDED_CIRCULAR });
  }

  /** One decision's rule by its key (the settings window). */
  get(action: ResolutionAction): ActionRule | undefined {
    return this.value.items.find((r) => r.action === action);
  }

  /** The majority a decision fixes (seeded: statute change two thirds, dissolution three quarters). */
  fixedMajority(action: ResolutionAction): Majority | null {
    return this.value.items.find((r) => r.action === action)?.majority ?? null;
  }

  /** Not removed by the club (true until loaded). */
  enabled(action: ResolutionAction): boolean {
    return this.value.items.find((r) => r.action === action)?.enabled !== false;
  }

  /** Removed decisions keep their name on passed resolutions, marked; the club's own carry their name. */
  label(action: ResolutionAction): string {
    const name = actionLabel(action, this.value.items);
    return this.enabled(action) ? name : `${name} (entfernt)`;
  }

  /** Every decision the club offers, built-in ones first. */
  all(): ResolutionAction[] {
    return allActions(this.value.items).filter((a) => this.enabled(a));
  }

  /** What a resolution of this meeting type (null: circular vote) may decide. */
  forType(type: MeetingType | null): ResolutionAction[] {
    return actions(type, this.value.items).filter((a) => this.enabled(a));
  }
}
