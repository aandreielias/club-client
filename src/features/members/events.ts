// Live events of the members module (server: MembersApi.MemberInvited / MemberDeactivated).

import { liveEvent } from '../../lib/live/LiveUpdates.svelte';

export const MEMBER_INVITED = liveEvent<MemberEvent>('members.member-invited');
export const MEMBER_DEACTIVATED = liveEvent<MemberEvent>('members.member-deactivated');

export interface MemberEvent {
  memberId: string;
}
