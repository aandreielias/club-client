import type { SessionStore } from '../session/SessionStore.svelte';
import type { Team } from '../types';
import type { ClubPermissions } from './ClubPermissions';

/** What appointments and tasks share: who plans them, club-wide or for which teams, and which teams the filter offers. */
export abstract class PlanningPolicy {
  constructor(
    protected readonly session: SessionStore,
    protected readonly permissions: ClubPermissions,
  ) {}

  canCreate(): boolean {
    return this.permissions.canManageAnything();
  }

  canCreateClubWide(): boolean {
    return this.permissions.canManageClubWide();
  }

  plannableTeams(): readonly Team[] {
    return this.permissions.manageableTeams();
  }

  filterableTeams(): readonly Team[] {
    return this.permissions.filterableTeams();
  }
}
