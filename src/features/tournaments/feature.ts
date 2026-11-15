import { PRIVILEGED } from '../../lib/types';
import { detailRoute, type Feature } from '../Feature';
import { TOURNAMENT_MESSAGES } from './messages';
import { tournamentActions } from './actions';
import TournamentCreateView from './TournamentCreateView.svelte';
import TournamentsPage from './TournamentsPage.svelte';
import TournamentsHome from './TournamentsHome.svelte';
import TournamentView from './TournamentView.svelte';

export const tournamentsFeature: Feature = {
  id: 'tournaments',
  home: { id: 'tournaments', label: 'Turniere', component: TournamentsHome },
  routes: [
    // Every member reads tournaments; tournament guests too (their own only, server: TournamentHandlers.visible).
    { path: '/tournaments', component: TournamentsPage, nav: 'Turniere', icon: 'trophy', guest: 'TOURNAMENTS' },
    detailRoute('/tournaments/:id', TournamentView, { href: '/tournaments', label: 'Turniere' }, { guest: 'TOURNAMENTS' }),
  ],
  actions: { tournament: tournamentActions },
  windows: {
    tournament: { component: TournamentView, page: (id) => `/tournaments/${encodeURIComponent(id)}` },
    'tournament-new': { component: TournamentCreateView, roles: PRIVILEGED },
  },
  messages: TOURNAMENT_MESSAGES,
};
