import { api, bus, session } from '../../lib/container';
import { BoardSettingsStore } from './BoardSettingsStore.svelte';
import { MemberPolicy } from './MemberPolicy';
import { MembersApi } from './MembersApi';
import { MembershipKindsStore } from './MembershipKindsStore.svelte';

/** Member administration services, created once and shared by the member pages. */
export const membersApi = new MembersApi(api);
export const memberPolicy = new MemberPolicy(session);
export const boardSettings = new BoardSettingsStore(membersApi, bus);
export const membershipKinds = new MembershipKindsStore(membersApi, bus);
