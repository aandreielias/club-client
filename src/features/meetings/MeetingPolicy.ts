import type { SessionStore } from '../../lib/session/SessionStore.svelte';
import { ADMIN_BOARD } from '../../lib/types';
import type { OfficeKind } from '../members/MembersApi';
import type { MeetingKind } from './model';

/** Client-side mirror of MeetingRules (who convenes); the server decides, and tells per meeting with `canManage`. */
export class MeetingPolicy {
  constructor(private readonly session: SessionStore) {}

  canCreate(): boolean {
    return this.session.hasRole(...ADMIN_BOARD);
  }

  /** server: MeetingRules.mayConvene — §8 Abs 4, §10 Abs 3–7; admins act for the board. */
  mayConvene(kind: MeetingKind, offices: readonly OfficeKind[]): boolean {
    if (this.session.hasRole('ADMIN')) return true;
    const board = offices.some((o) => o !== 'AUDITOR');
    const chair = offices.includes('CHAIR') || offices.includes('VICE_CHAIR');
    return kind === 'ASSEMBLY' || kind === 'EXTRA_ASSEMBLY' || kind === 'SIMPLE_BOARD' ? board : chair;
  }
}
