import { lazy } from '../../ui/lazy';
import { bus, directory, permissions } from '../../lib/container';
import { LIVE_RESYNC } from '../../lib/live/LiveUpdates.svelte';
import { MEMBER_CHANGED } from './events';
import { ADMIN_BOARD } from '../../lib/types';
import { detailRoute, type Feature } from '../Feature';
import { MEMBER_MESSAGES } from './messages';
import { memberActions, membershipKindActions, officeSettingActions } from './actions';
import { boardSettings, memberPolicy, membershipKinds } from './services';

const BoardPage = lazy(() => import('./BoardPage.svelte'));
const MembersHome = lazy(() => import('./MembersHome.svelte'));
const BoardHome = lazy(() => import('./BoardHome.svelte'));
const MemberInviteView = lazy(() => import('./MemberInviteView.svelte'));
const MemberView = lazy(() => import('./MemberView.svelte'));
const MembersPage = lazy(() => import('./MembersPage.svelte'));
const MembershipKindCreateView = lazy(() => import('./MembershipKindCreateView.svelte'));
const OfficeAssignView = lazy(() => import('./OfficeAssignView.svelte'));
const OfficeSettingCreateView = lazy(() => import('./OfficeSettingCreateView.svelte'));
const OfficeSettingView = lazy(() => import('./OfficeSettingView.svelte'));
const MembershipKindView = lazy(() => import('./MembershipKindView.svelte'));

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
    // Names shown everywhere (pickers, MemberName) follow renames, joins and leaves.
    const names = () => {
      directory.forgetMembers();
      void directory.loadNames();
    };
    const subscriptions = [bus.subscribe(MEMBER_CHANGED, names), bus.subscribe(LIVE_RESYNC, names)];
    const stops = [boardSettings.start(), membershipKinds.start(), () => subscriptions.forEach((s) => s.unsubscribe())];
    return () => stops.forEach((stop) => stop());
  },
  home: [
    { id: 'members', label: 'Mitglieder', component: MembersHome, roles: ADMIN_BOARD },
    { id: 'board', label: 'Vorstand', component: BoardHome },
  ],
};
