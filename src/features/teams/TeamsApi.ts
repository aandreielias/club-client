import type { ApiClient } from '../../lib/http/ApiClient';
import type { Roster, Team, TeamRole } from '../../lib/types';

/** Typed access to the teams endpoints of club-server. Membership writes answer with the new roster. */
export class TeamsApi {
  static readonly BASE = '/api/v1/teams';

  constructor(private readonly api: ApiClient) {}

  async list(mine: boolean): Promise<Team[]> {
    return (await this.api.get<{ items: Team[] }>(TeamsApi.BASE, { mine })).items;
  }

  create(name: string, season: string): Promise<Team> {
    return this.api.post<Team>(TeamsApi.BASE, { name, season });
  }

  update(teamId: string, patch: { name?: string; season?: string; archived?: boolean }): Promise<Team> {
    return this.api.patch<Team>(this.path(teamId), patch);
  }

  /** server: refused with team.in-use while appointments, tasks or folders belong to the team. */
  delete(teamId: string): Promise<void> {
    return this.api.delete(this.path(teamId));
  }

  roster(teamId: string): Promise<Roster> {
    return this.api.get<Roster>(`${this.path(teamId)}/roster`);
  }

  /** Adds the member, or changes their role when they are already in the team. */
  setMember(teamId: string, memberId: string, teamRole: TeamRole): Promise<Roster> {
    return this.api.put<Roster>(`${this.path(teamId)}/members/${encodeURIComponent(memberId)}`, { teamRole });
  }

  removeMember(teamId: string, memberId: string): Promise<Roster> {
    return this.api.delete<Roster>(`${this.path(teamId)}/members/${encodeURIComponent(memberId)}`);
  }

  /** Shirt number, position, captain (one per team). */
  setPlayerInfo(teamId: string, memberId: string, info: { jersey: number | null; position: string | null; captain: boolean }): Promise<Roster> {
    return this.api.put<Roster>(`${this.path(teamId)}/members/${encodeURIComponent(memberId)}/info`, info);
  }

  /** The next season with the same roster. */
  copy(teamId: string, season: string, name: string | null = null): Promise<Team> {
    return this.api.post<Team>(`${this.path(teamId)}/copy`, { season, name });
  }

  /** A coach asks admin and board to add a member (or a person described in the note). */
  requestPlayer(teamId: string, memberId: string | null, note: string | null): Promise<void> {
    return this.api.post(`${this.path(teamId)}/player-requests`, { memberId, note });
  }

  private path(teamId: string): string {
    return `${TeamsApi.BASE}/${encodeURIComponent(teamId)}`;
  }
}
