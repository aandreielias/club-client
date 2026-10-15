import type { SessionStore } from '../../lib/session/SessionStore.svelte';
import { PRIVILEGED } from '../../lib/types';

/** server: InventoryHandlers. Every member sees the inventory; admin, board and coaches manage it. */
export class InventoryPolicy {
  constructor(private readonly session: SessionStore) {}

  canManage(): boolean {
    return this.session.hasRole(...PRIVILEGED);
  }
}
