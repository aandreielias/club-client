import { session } from '../../lib/container';
import { PRIVILEGED } from '../../lib/types';
import { tournamentsApi } from './services';
import { TournamentCalendarSource } from './TournamentCalendarSource';
import type { Feature } from '../Feature';
import { TOURNAMENT_MESSAGES } from './messages';
import TournamentCreateView from './TournamentCreateView.svelte';
import TournamentPage from './TournamentPage.svelte';
import TournamentsPage from './TournamentsPage.svelte';
import TournamentView from './TournamentView.svelte';

export const tournamentsFeature: Feature = {
  id: 'tournaments',
  routes: [
    // Every member reads tournaments; guests too (their own only, server: TournamentHandlers.visible).
    { path: '/tournaments', component: TournamentsPage, nav: 'Turniere', icon: 'trophy', guest: true },
    { path: '/tournaments/:id', component: TournamentPage, guest: true },
  ],
  windows: {
    tournament: { component: TournamentView, page: (id) => `/tournaments/${encodeURIComponent(id)}` },
    'tournament-new': { component: TournamentCreateView, roles: PRIVILEGED },
  },
  calendar: new TournamentCalendarSource(tournamentsApi, () => session.clock),
  messages: TOURNAMENT_MESSAGES,
};
