import BoardPage from './BoardPage.svelte';
import MembersHome from './MembersHome.svelte';
import BoardHome from './BoardHome.svelte';
import { permissions } from '../../lib/container';
import { ADMIN_BOARD } from '../../lib/types';
import type { Feature } from '../Feature';
import MemberInviteView from './MemberInviteView.svelte';
import MemberPage from './MemberPage.svelte';
import MemberView from './MemberView.svelte';
import { MEMBER_MESSAGES } from './messages';
import { boardSettings } from './services';
import MembersPage from './MembersPage.svelte';

export const membersFeature: Feature = {
  id: 'members',
  routes: [
    { path: '/members', component: MembersPage, nav: 'Mitglieder', icon: 'members', roles: ADMIN_BOARD },
    // Coaches open profiles of their team members (server: requireMaySee).
    // Guardians open their wards' profiles too (server: requireMaySee); the window checks per member.
    { path: '/members/:id', component: MemberPage },
    // Who holds which function is known club-wide (server: LIST_OFFICES for every member).
    { path: '/board', component: BoardPage, nav: 'Vorstand', icon: 'club' },
  ],
  windows: {
    // server: requireMaySee - coaches only the members of their teams.
    member: { component: MemberView, page: (id) => `/members/${encodeURIComponent(id)}`, canOpen: (id) => permissions.canSeeMember(id) },
    'member-new': { component: MemberInviteView, roles: ADMIN_BOARD },
  },
  messages: MEMBER_MESSAGES,
  start: () => boardSettings.start(),
  home: [
    { id: 'members', label: 'Mitglieder (braucht den Vereins-PIN)', component: MembersHome, roles: ADMIN_BOARD },
    { id: 'board', label: 'Vorstand', component: BoardHome },
  ],
};
