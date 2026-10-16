import type { ApiClient } from '../http/ApiClient';
import type { SessionStore } from '../session/SessionStore.svelte';
import type { Member, MemberList, Roster, RosterEntry, Team, TeamRole } from '../types';

/**
 * Shared lookup of teams, rosters and member names. Feature DTOs carry only ids, so pages resolve
 * names here. Sources: GET /teams (everyone), rosters (team members and admin/board) and the
 * member list (admin/board with step-up, loaded only on explicit request).
 */
export class TeamDirectory {
  /** All teams of the club. */
  teams = $state.raw<readonly Team[]>([]);

  #names = $state<Record<string, string>>({});
  #rosters = $state<Record<string, Roster>>({});
  #pendingRosters = new Map<string, Promise<Roster | null>>();
  #teamsLoad: Promise<void> | null = null;
  #membersLoad: Promise<readonly Member[]> | null = null;

  constructor(
    private readonly api: ApiClient,
    private readonly session: SessionStore,
  ) {}

  /** Loads the team list once per session. */
  loadTeams(): Promise<void> {
    this.#teamsLoad ??= this.api
      .get<{ items: Team[] }>('/api/v1/teams')
      .then(({ items }) => {
        this.teams = items;
      })
      .catch((error) => {
        this.#teamsLoad = null;
        throw error;
      });
    return this.#teamsLoad;
  }

  /** Roster of one team, cached; null when the member may not see it. */
  roster(teamId: string): Promise<Roster | null> {
    let pending = this.#pendingRosters.get(teamId);
    if (!pending) {
      pending = this.api
        .get<Roster>(`/api/v1/teams/${encodeURIComponent(teamId)}/roster`)
        .then((roster) => {
          this.#rosters[teamId] = roster;
          this.remember(roster.entries);
          return roster;
        })
        .catch(() => null);
      this.#pendingRosters.set(teamId, pending);
    }
    return pending;
  }

  /** Loads the rosters of the given teams (plus the member's own teams) for name lookups. */
  async loadRosters(teamIds: Iterable<string | null> = []): Promise<void> {
    const ids = new Set([...teamIds].filter((id): id is string => !!id));
    this.session.teams.forEach((t) => ids.add(t.id));
    await Promise.all([...ids].map((id) => this.roster(id)));
  }

  /** Every member (admin/board only; the server asks for a step-up). */
  allMembers(): Promise<readonly Member[]> {
    this.#membersLoad ??= this.api
      .get<MemberList>('/api/v1/members')
      .then(({ items }) => {
        this.remember(items.map((m) => ({ memberId: m.id, name: `${m.firstName} ${m.lastName}` })));
        return items;
      })
      .catch((error) => {
        this.#membersLoad = null;
        throw error;
      });
    return this.#membersLoad;
  }

  /** Candidates for a team (its roster) or, for club-wide items, all active members. */
  async candidates(teamId: string | null): Promise<readonly Pick<RosterEntry, 'memberId' | 'name'>[]> {
    if (teamId) return (await this.roster(teamId))?.entries ?? [];
    return (await this.allMembers()).filter((m) => m.active).map((m) => ({ memberId: m.id, name: `${m.firstName} ${m.lastName}` }));
  }

  nameOf(memberId: string, fallback = 'Mitglied'): string {
    return this.knownName(memberId) ?? fallback;
  }

  /** The member's name if any loaded source contains it, else null. */
  knownName(memberId: string): string | null {
    const me = this.session.me?.member;
    if (me && me.id === memberId) return `${me.firstName} ${me.lastName}`;
    return this.#names[memberId] ?? this.session.me?.wardNames?.[memberId] ?? null;
  }

  teamName(teamId: string | null): string | null {
    if (!teamId) return null;
    return this.session.teamName(teamId) ?? this.teams.find((t) => t.id === teamId)?.name ?? null;
  }

  /** The member's role in a team, known once that team's roster is loaded. */
  teamRole(teamId: string, memberId: string): TeamRole | null {
    return this.#rosters[teamId]?.entries.find((e) => e.memberId === memberId)?.teamRole ?? null;
  }

  /** Names of the loaded teams whose roster contains the member, sorted. */
  teamsOf(memberId: string): string[] {
    return Object.values(this.#rosters)
      .filter((r) => r.entries.some((e) => e.memberId === memberId))
      .map((r) => r.team.name)
      .sort((a, b) => a.localeCompare(b, 'de'));
  }

  /** Forgets the team list (e.g. after a team was created) so the next loadTeams reloads it. */
  forgetTeams(): void {
    this.#teamsLoad = null;
  }

  /** Drops one cached roster (e.g. after a membership change) so the next lookup reloads it. */
  forgetRoster(teamId: string): void {
    this.#pendingRosters.delete(teamId);
    delete this.#rosters[teamId];
  }

  /** Forgets cached rosters and members (e.g. after logout). */
  clear(): void {
    this.#names = {};
    this.#rosters = {};
    this.#pendingRosters.clear();
    this.#membersLoad = null;
    this.#teamsLoad = null;
    this.teams = [];
  }

  private remember(entries: readonly { memberId: string; name: string }[]): void {
    for (const entry of entries) this.#names[entry.memberId] = entry.name;
  }
}
