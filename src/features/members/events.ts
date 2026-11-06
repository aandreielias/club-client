// Live events of the members module (server: MembersApi.MemberInvited / MemberDeactivated).

import { defineEvent } from '../../lib/bus';
import { liveEvent } from '../../lib/live/LiveUpdates.svelte';

/** A function was given in this browser (the server pushes no event for it); the board list reloads. */
export const OFFICES_CHANGED = defineEvent('members/offices-changed');

export const MEMBER_INVITED = liveEvent<MemberEvent>('members.member-invited');
export const MEMBER_DEACTIVATED = liveEvent<MemberEvent>('members.member-deactivated');

export interface MemberEvent {
  memberId: string;
}
