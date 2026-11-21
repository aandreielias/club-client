// Live events of the members module (server: MembersApi.MemberInvited / MemberDeactivated / MemberChanged).

import { defineEvent } from '../../lib/bus';
import { liveEvent } from '../../lib/live/LiveUpdates.svelte';

/** A function was given in this browser (the server pushes no event for it); the board list reloads. */
export const OFFICES_CHANGED = defineEvent('members/offices-changed');

export const MEMBER_INVITED = liveEvent<MemberEvent>('members.member-invited');
export const MEMBER_DEACTIVATED = liveEvent<MemberEvent>('members.member-deactivated');
/** Profile, membership, roles or family of a member changed (every member hears it). */
export const MEMBER_CHANGED = liveEvent<MemberEvent>('members.member-changed');

export interface MemberEvent {
  memberId: string;
}
