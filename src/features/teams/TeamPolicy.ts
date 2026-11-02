import type { ClubPermissions } from '../../lib/policy/ClubPermissions';
import type { SessionStore } from '../../lib/session/SessionStore.svelte';
import type { RosterEntry } from '../../lib/types';

/** Client-side mirror of TeamHandlers: admin/board manage everything, coaches remove players of their team. */
export class TeamPolicy {
  constructor(
    private readonly session: SessionStore,
    private readonly permissions: ClubPermissions,
  ) {}

  canCreate(): boolean {
    return this.permissions.isManager;
  }

  /** Renaming and deleting teams is admin/board only (server: TeamHandlers.update/delete). */
  canEdit(): boolean {
    return this.permissions.isManager;
  }

  /** Adding members and changing roles is admin/board only (coaches would gain access to member data). */
  canAssign(): boolean {
    return this.permissions.isManager;
  }

  canRemove(teamId: string, entry: RosterEntry): boolean {
    if (this.permissions.isManager) return true;
    return this.permissions.isCoachOf(teamId) && entry.teamRole === 'PLAYER' && entry.memberId !== this.session.member.id;
  }

  /** Shirt number, position, captain: admin/board and the team's coaches (server: TeamHandlers.setPlayerInfo). */
  canSetPlayerInfo(teamId: string): boolean {
    return this.permissions.isManager || this.permissions.isCoachOf(teamId);
  }

  /** Coaches ask admin and board to add someone (server: TeamHandlers.requestPlayer). */
  canRequestPlayer(teamId: string): boolean {
    return !this.permissions.isManager && this.permissions.isCoachOf(teamId);
  }

  /** Member profiles open for admin/board, the team's coaches and the member themself (server: requireMaySee). */
  canOpenProfile(teamId: string, entry: RosterEntry): boolean {
    return this.permissions.isManager || this.permissions.isCoachOf(teamId) || entry.memberId === this.session.member.id;
  }
}
