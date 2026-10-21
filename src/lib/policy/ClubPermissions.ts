import type { TeamDirectory } from '../directory/TeamDirectory.svelte';
import type { SessionStore } from '../session/SessionStore.svelte';
import { ADMIN_BOARD, PRIVILEGED, type Team } from '../types';

/**
 * The club-wide permission pattern shared by calendar and tasks (server: requireMayEdit /
 * requireMayManage): club-wide items are managed by admin/board, team items additionally by the
 * team's coaches. Used only to show or hide actions; the server always decides.
 */
export class ClubPermissions {
  constructor(
    private readonly session: SessionStore,
    private readonly directory: TeamDirectory,
  ) {}

  get isManager(): boolean {
    return this.session.hasRole(...ADMIN_BOARD);
  }

  /** Admin, board or coach: inventory, profiles of team members, creating entries. */
  get isPrivileged(): boolean {
    return this.session.hasRole(...PRIVILEGED);
  }

  /**
   * Whose profile the member may open (server: requireMaySee): admin/board everyone, coaches the
   * members of their teams (exact once those rosters are loaded), everyone themselves.
   */
  canSeeMember(memberId: string): boolean {
    if (this.isManager || memberId === this.session.member.id) return true;
    return this.session.teams.some((t) => this.isCoachOf(t.id) && this.directory.teamRole(t.id, memberId) !== null);
  }

  get isCoach(): boolean {
    return this.session.hasRole('COACH');
  }

  /** Exact once the team's roster is loaded; until then a COACH in the team counts as its coach. */
  isCoachOf(teamId: string): boolean {
    if (!this.isCoach || !this.session.isInTeam(teamId)) return false;
    const role = this.directory.teamRole(teamId, this.session.member.id);
    return role === null || role === 'COACH';
  }

  canManage(teamId: string | null): boolean {
    if (this.isManager) return true;
    return teamId !== null && this.isCoachOf(teamId);
  }

  canManageClubWide(): boolean {
    return this.isManager;
  }

  /** Teams the member may plan for. */
  manageableTeams(): readonly Team[] {
    return this.isManager ? this.directory.teams : this.session.teams.filter((t) => this.isCoachOf(t.id));
  }

  canManageAnything(): boolean {
    return this.isManager || this.manageableTeams().length > 0;
  }

  /** Teams offered as filters: every team for admin/board, otherwise the member's own. */
  filterableTeams(): readonly Team[] {
    return this.isManager && this.directory.teams.length ? this.directory.teams : this.session.teams;
  }
}
