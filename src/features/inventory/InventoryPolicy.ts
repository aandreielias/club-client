import type { SessionStore } from '../../lib/session/SessionStore.svelte';
import { PRIVILEGED } from '../../lib/types';

/** server: InventoryHandlers. Only admin, board and coaches see and manage the inventory. */
export class InventoryPolicy {
  constructor(private readonly session: SessionStore) {}

  canManage(): boolean {
    return this.session.hasRole(...PRIVILEGED);
  }
}
