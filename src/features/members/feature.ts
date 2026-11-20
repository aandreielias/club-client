import BoardPage from './BoardPage.svelte';
import MembersHome from './MembersHome.svelte';
import BoardHome from './BoardHome.svelte';
import { permissions } from '../../lib/container';
import { ADMIN_BOARD } from '../../lib/types';
import { detailRoute, type Feature } from '../Feature';
import MemberInviteView from './MemberInviteView.svelte';
import MemberView from './MemberView.svelte';
import { MEMBER_MESSAGES } from './messages';
import { memberActions, membershipKindActions, officeSettingActions } from './actions';
import { boardSettings, memberPolicy, membershipKinds } from './services';
import MembersPage from './MembersPage.svelte';
import MembershipKindCreateView from './MembershipKindCreateView.svelte';
import OfficeAssignView from './OfficeAssignView.svelte';
import OfficeSettingCreateView from './OfficeSettingCreateView.svelte';
import OfficeSettingView from './OfficeSettingView.svelte';
import MembershipKindView from './MembershipKindView.svelte';

export const membersFeature: Feature = {
  id: 'members',
  routes: [
    // Every member: profiles they may open in full, the others by name (server: MemberHandlers.list); ?view=org shows the
    // Organigramm to coaches, admin and board.
    { path: '/members', component: MembersPage, nav: 'Mitglieder', icon: 'members' },
    // Coaches open profiles of their team members (server: requireMaySee).
    // Guardians open their wards' profiles too (server: requireMaySee); the window checks per member.
    detailRoute('/members/:id', MemberView, { href: '/members', label: 'Mitglieder' }),
    // Who holds which function is known club-wide (server: LIST_OFFICES for every member).
    { path: '/board', component: BoardPage, nav: 'Vorstand', icon: 'club' },
    detailRoute('/membership-kinds/:key', MembershipKindView, { href: '/settings/membership', label: 'Mitgliedschaft' }, { roles: ADMIN_BOARD }),
  ],
  actions: { member: memberActions, 'membership-kind': membershipKindActions, 'office-setting': officeSettingActions },
  windows: {
    // server: requireMaySee - coaches only the members of their teams.
    member: {
      label: 'Mitglied',
      component: MemberView,
      page: (id) => `/members/${encodeURIComponent(id)}`,
      canOpen: (id) => permissions.canSeeMember(id),
    },
    'member-new': { label: 'Neues Mitglied', component: MemberInviteView, roles: ADMIN_BOARD },
    'membership-kind': {
      label: 'Mitgliedsart',
      component: MembershipKindView,
      page: (key) => `/membership-kinds/${encodeURIComponent(key)}`,
      roles: ADMIN_BOARD,
    },
    'membership-kind-new': { label: 'Neue Mitgliedsart', component: MembershipKindCreateView, roles: ADMIN_BOARD },
    'office-setting': { label: 'Funktion', component: OfficeSettingView, roles: ADMIN_BOARD },
    'office-setting-new': { label: 'Neue Funktion', component: OfficeSettingCreateView, roles: ADMIN_BOARD },
    'office-assign': { label: 'Funktion besetzen', component: OfficeAssignView, canOpen: () => memberPolicy.canManageOffices() },
  },
  messages: MEMBER_MESSAGES,
  start: (guest) => {
    if (guest) return;
    const stops = [boardSettings.start(), membershipKinds.start()];
    return () => stops.forEach((stop) => stop());
  },
  home: [
    { id: 'members', label: 'Mitglieder', component: MembersHome, roles: ADMIN_BOARD },
    { id: 'board', label: 'Vorstand', component: BoardHome },
  ],
};
