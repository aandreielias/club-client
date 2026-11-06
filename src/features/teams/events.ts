// Live event of the teams module (server: TeamsApi.MembershipChanged).

import { defineEvent } from '../../lib/bus';
import { liveEvent } from '../../lib/live/LiveUpdates.svelte';

export const MEMBERSHIP_CHANGED = liveEvent<MembershipChanged>('teams.membership-changed');

export interface MembershipChanged {
  teamId: string;
  memberId: string;
}

/** A team was created or renamed in this browser (the server pushes no event for it); team lists reload. */
export const TEAMS_CHANGED = defineEvent('teams/changed');
