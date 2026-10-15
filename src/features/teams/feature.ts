import type { Feature } from '../Feature';
import { TEAM_MESSAGES } from './messages';
import TeamPage from './TeamPage.svelte';
import TeamsPage from './TeamsPage.svelte';

export const teamsFeature: Feature = {
  id: 'teams',
  routes: [
    { path: '/teams', component: TeamsPage, nav: 'Teams' },
    { path: '/teams/:id', component: TeamPage },
  ],
  messages: TEAM_MESSAGES,
};
