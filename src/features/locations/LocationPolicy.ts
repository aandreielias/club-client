import type { SessionStore } from '../../lib/session/SessionStore.svelte';
import { PRIVILEGED } from '../../lib/types';

/** server: LocationHandlers. Every member sees the places; admin, board and coaches manage them. */
export class LocationPolicy {
  constructor(private readonly session: SessionStore) {}

  canManage(): boolean {
    return this.session.hasRole(...PRIVILEGED);
  }
}
