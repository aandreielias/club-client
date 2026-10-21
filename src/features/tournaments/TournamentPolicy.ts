import type { SessionStore } from '../../lib/session/SessionStore.svelte';
import { ADMIN_BOARD, PRIVILEGED } from '../../lib/types';

/** server: TournamentHandlers. Admin, board and coaches run tournaments; admin and board invite guests and delete. */
export class TournamentPolicy {
  constructor(private readonly session: SessionStore) {}

  canManage(): boolean {
    return this.session.hasRole(...PRIVILEGED);
  }

  canInviteGuests(): boolean {
    return this.session.hasRole(...ADMIN_BOARD);
  }

  canDelete(): boolean {
    return this.session.hasRole(...ADMIN_BOARD);
  }
}
