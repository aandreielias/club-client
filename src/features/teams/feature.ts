import type { Feature } from '../Feature';
import { TEAM_MESSAGES } from './messages';
import TeamPage from './TeamPage.svelte';
import TeamsPage from './TeamsPage.svelte';
import TeamView from './TeamView.svelte';

export const teamsFeature: Feature = {
  id: 'teams',
  routes: [
    { path: '/teams', component: TeamsPage, nav: 'Teams', icon: 'teams' },
    { path: '/teams/:id', component: TeamPage },
  ],
  windows: {
    team: { component: TeamView, page: (id) => `/teams/${encodeURIComponent(id)}` },
  },
  messages: TEAM_MESSAGES,
};
