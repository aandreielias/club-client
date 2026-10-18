// Live event types of the tournaments module (server: TournamentsApi.TournamentChanged).

import { liveEvent } from '../../lib/live/LiveUpdates.svelte';

export const TOURNAMENT_CHANGED = liveEvent<TournamentChanged>('tournaments.tournament-changed');

export interface TournamentChanged {
  tournamentId: string;
  change: 'CREATED' | 'UPDATED' | 'DELETED';
}
