import BoardPage from './BoardPage.svelte';
import MembersHome from './MembersHome.svelte';
import BoardHome from './BoardHome.svelte';
import { permissions } from '../../lib/container';
import { ADMIN_BOARD, PRIVILEGED } from '../../lib/types';
import { detailRoute, type Feature } from '../Feature';
import MemberInviteView from './MemberInviteView.svelte';
import MemberView from './MemberView.svelte';
import { MEMBER_MESSAGES } from './messages';
import { boardSettings, memberPolicy, membershipKinds } from './services';
import MembersPage from './MembersPage.svelte';
import MembershipKindCreateView from './MembershipKindCreateView.svelte';
import OfficeAssignView from './OfficeAssignView.svelte';
import OrgChartPage from './OrgChartPage.svelte';
import OfficeSettingCreateView from './OfficeSettingCreateView.svelte';
import OfficeSettingView from './OfficeSettingView.svelte';
import MembershipKindView from './MembershipKindView.svelte';

export const membersFeature: Feature = {
  id: 'members',
  routes: [
    { path: '/members', component: MembersPage, nav: 'Mitglieder', icon: 'members', roles: ADMIN_BOARD },
    // Coaches open profiles of their team members (server: requireMaySee).
    // Guardians open their wards' profiles too (server: requireMaySee); the window checks per member.
    detailRoute('/members/:id', MemberView, () =>
      memberPolicy.isManager ? { href: '/members', label: 'Mitglieder' } : { href: '/teams', label: 'Teams' },
    ),
    // Who holds which function is known club-wide (server: LIST_OFFICES for every member).
    { path: '/board', component: BoardPage, nav: 'Vorstand', icon: 'club' },
    // server: MemberHandlers.orgChart — coaches see only their teams and those members' guardians.
    { path: '/org-chart', component: OrgChartPage, nav: 'Organigramm', icon: 'orgChart', roles: PRIVILEGED },
    detailRoute('/membership-kinds/:key', MembershipKindView, { href: '/settings/membership', label: 'Mitgliedschaft' }, { roles: ADMIN_BOARD }),
  ],
  windows: {
    // server: requireMaySee - coaches only the members of their teams.
    member: { component: MemberView, page: (id) => `/members/${encodeURIComponent(id)}`, canOpen: (id) => permissions.canSeeMember(id) },
    'member-new': { component: MemberInviteView, roles: ADMIN_BOARD },
    'membership-kind': { component: MembershipKindView, page: (key) => `/membership-kinds/${encodeURIComponent(key)}`, roles: ADMIN_BOARD },
    'membership-kind-new': { component: MembershipKindCreateView, roles: ADMIN_BOARD },
    'office-setting': { component: OfficeSettingView, roles: ADMIN_BOARD },
    'office-setting-new': { component: OfficeSettingCreateView, roles: ADMIN_BOARD },
    'office-assign': { component: OfficeAssignView, canOpen: () => memberPolicy.canManageOffices() },
  },
  messages: MEMBER_MESSAGES,
  start: () => {
    const stops = [boardSettings.start(), membershipKinds.start()];
    return () => stops.forEach((stop) => stop());
  },
  home: [
    { id: 'members', label: 'Mitglieder', component: MembersHome, roles: ADMIN_BOARD },
    { id: 'board', label: 'Vorstand', component: BoardHome },
  ],
};
