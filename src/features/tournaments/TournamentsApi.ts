import type { ApiClient } from '../../lib/http/ApiClient';
import type { GuestInput, NewTournament, ResultInput, TeamInput, Tournament, TournamentSummary } from './model';

/** Typed access to the tournament endpoints of club-server. */
export class TournamentsApi {
  static readonly BASE = '/api/v1/tournaments';

  constructor(private readonly api: ApiClient) {}

  async list(): Promise<TournamentSummary[]> {
    return (await this.api.get<{ items: TournamentSummary[] }>(TournamentsApi.BASE)).items;
  }

  get(id: string): Promise<Tournament> {
    return this.api.get<Tournament>(this.path(id));
  }

  create(tournament: NewTournament): Promise<Tournament> {
    return this.api.post<Tournament>(TournamentsApi.BASE, tournament);
  }

  update(id: string, patch: Partial<NewTournament>): Promise<Tournament> {
    return this.api.patch<Tournament>(this.path(id), patch);
  }

  delete(id: string): Promise<void> {
    return this.api.delete(this.path(id));
  }

  /** Before the draw; teams without id are new. */
  setTeams(id: string, teams: readonly TeamInput[]): Promise<Tournament> {
    return this.api.put<Tournament>(`${this.path(id)}/teams`, { teams });
  }

  draw(id: string): Promise<Tournament> {
    return this.api.post<Tournament>(`${this.path(id)}/draw`);
  }

  startKnockout(id: string): Promise<Tournament> {
    return this.api.post<Tournament>(`${this.path(id)}/knockout`);
  }

  setResult(id: string, matchId: string, result: ResultInput): Promise<Tournament> {
    return this.api.put<Tournament>(`${this.path(id)}/matches/${encodeURIComponent(matchId)}`, result);
  }

  inviteGuest(id: string, guest: GuestInput): Promise<Tournament> {
    return this.api.post<Tournament>(`${this.path(id)}/guests`, guest);
  }

  private path(id: string): string {
    return `${TournamentsApi.BASE}/${encodeURIComponent(id)}`;
  }
}
