import MembersHome from './MembersHome.svelte';
import { permissions } from '../../lib/container';
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
    { path: '/members', component: MembersPage, nav: 'Mitglieder', icon: 'members', roles: MANAGERS },
    // Coaches open profiles of their team members (server: requireMaySee).
    { path: '/members/:id', component: MemberPage, roles: PRIVILEGED },
  ],
  windows: {
    // server: requireMaySee - coaches only the members of their teams.
    member: { component: MemberView, page: (id) => `/members/${encodeURIComponent(id)}`, roles: PRIVILEGED, canOpen: (id) => permissions.canSeeMember(id) },
    'member-new': { component: MemberInviteView, roles: MANAGERS },
  },
  messages: MEMBER_MESSAGES,
  home: { id: 'members', label: 'Mitglieder (braucht die PIN)', component: MembersHome, roles: MANAGERS },
};
