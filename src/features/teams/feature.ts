import TeamsHome from './TeamsHome.svelte';
import { detailRoute, type Feature } from '../Feature';
import { TEAM_MESSAGES } from './messages';
import { teamPolicy } from './services';
import TeamsPage from './TeamsPage.svelte';
import TeamCreateView from './TeamCreateView.svelte';
import TeamView from './TeamView.svelte';

export const teamsFeature: Feature = {
  id: 'teams',
  routes: [
    { path: '/teams', component: TeamsPage, nav: 'Teams', icon: 'teams' },
    detailRoute('/teams/:id', TeamView, { href: '/teams', label: 'Teams' }),
  ],
  windows: {
    team: { component: TeamView, page: (id) => `/teams/${encodeURIComponent(id)}` },
    'team-new': { component: TeamCreateView, canOpen: () => teamPolicy.canCreate() },
  },
  messages: TEAM_MESSAGES,
  home: { id: 'teams', label: 'Meine Teams', component: TeamsHome },
};
