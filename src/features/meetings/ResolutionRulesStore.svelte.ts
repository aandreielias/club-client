import type { EventBus } from '../../lib/bus';
import { LiveStore } from '../../lib/state/LiveStore.svelte';
import { RESOLUTION_RULES_CHANGED } from './events';
import type { MeetingsApi } from './MeetingsApi';
import { SEEDED_CIRCULAR, type ResolutionRules } from './model';

/** The club's resolution rules (server: meetings_setting): how circular votes of the board run. */
export class ResolutionRulesStore extends LiveStore<ResolutionRules> {
  constructor(api: MeetingsApi, bus: EventBus) {
    super(() => api.resolutionRules(), bus, RESOLUTION_RULES_CHANGED, { circular: SEEDED_CIRCULAR });
  }
}
