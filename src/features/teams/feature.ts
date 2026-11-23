import { lazy } from '../../ui/lazy';
import { detailRoute, type Feature } from '../Feature';
import { TEAM_MESSAGES } from './messages';
import { teamActions } from './actions';
import { teamPolicy } from './services';

const TeamsHome = lazy(() => import('./TeamsHome.svelte'));
const TeamsPage = lazy(() => import('./TeamsPage.svelte'));
const TeamCreateView = lazy(() => import('./TeamCreateView.svelte'));
const TeamView = lazy(() => import('./TeamView.svelte'));

export const teamsFeature: Feature = {
  id: 'teams',
  routes: [
    { path: '/teams', component: TeamsPage, nav: 'Teams', icon: 'teams' },
    detailRoute('/teams/:id', TeamView, { href: '/teams', label: 'Teams' }),
  ],
  actions: { team: teamActions },
  windows: {
    team: { label: 'Team', component: TeamView, page: (id) => `/teams/${encodeURIComponent(id)}` },
    'team-new': { label: 'Neues Team', component: TeamCreateView, canOpen: () => teamPolicy.canCreate() },
  },
  messages: TEAM_MESSAGES,
  home: { id: 'teams', label: 'Meine Teams', component: TeamsHome },
};
