import type { SessionStore } from '../../lib/session/SessionStore.svelte';
import { MANAGERS, PRIVILEGED } from '../../lib/types';

/** server: TournamentHandlers. Admin, board and coaches run tournaments; admin and board invite guests and delete. */
export class TournamentPolicy {
  constructor(private readonly session: SessionStore) {}

  canManage(): boolean {
    return this.session.hasRole(...PRIVILEGED);
  }

  canInviteGuests(): boolean {
    return this.session.hasRole(...MANAGERS);
  }

  canDelete(): boolean {
    return this.session.hasRole(...MANAGERS);
  }
}
