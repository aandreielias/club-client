import { MANAGERS, PRIVILEGED } from '../../lib/types';
import type { Feature } from '../Feature';
import MemberInviteView from './MemberInviteView.svelte';
import MemberPage from './MemberPage.svelte';
import MemberView from './MemberView.svelte';
import { MEMBER_MESSAGES } from './messages';
import MembersPage from './MembersPage.svelte';

export const membersFeature: Feature = {
  id: 'members',
  routes: [
    { path: '/members', component: MembersPage, nav: 'Mitglieder', roles: MANAGERS },
    // Coaches open profiles of their team members (server: requireMaySee).
    { path: '/members/:id', component: MemberPage, roles: PRIVILEGED },
  ],
  windows: {
    member: { component: MemberView, page: (id) => `/members/${encodeURIComponent(id)}` },
    'member-new': { component: MemberInviteView },
  },
  messages: MEMBER_MESSAGES,
};
