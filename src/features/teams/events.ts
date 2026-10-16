// Live event of the teams module (server: TeamsApi.MembershipChanged).

import { liveEvent } from '../../lib/live/LiveUpdates.svelte';

export const MEMBERSHIP_CHANGED = liveEvent<MembershipChanged>('teams.membership-changed');

export interface MembershipChanged {
  teamId: string;
  memberId: string;
}
