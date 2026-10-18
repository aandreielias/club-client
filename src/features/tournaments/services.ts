import { api, session } from '../../lib/container';
import { TournamentPolicy } from './TournamentPolicy';
import { TournamentsApi } from './TournamentsApi';

/** Tournament services, created once and shared by the tournament views. */
export const tournamentsApi = new TournamentsApi(api);
export const tournamentPolicy = new TournamentPolicy(session);
