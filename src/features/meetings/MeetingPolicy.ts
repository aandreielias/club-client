import type { SessionStore } from '../../lib/session/SessionStore.svelte';
import { ADMIN_BOARD } from '../../lib/types';
import type { OfficeKind } from '../members/MembersApi';
import { mayConvene, type MeetingType } from './model';

/** Client-side mirror of who convenes (MeetingType); the server decides, and tells per meeting with `canManage`. */
export class MeetingPolicy {
  constructor(private readonly session: SessionStore) {}

  canCreate(): boolean {
    return this.session.hasRole(...ADMIN_BOARD);
  }

  /** Admins act for the conveners. */
  mayConvene(type: MeetingType, offices: readonly OfficeKind[]): boolean {
    return mayConvene(type, this.session.hasRole('ADMIN'), offices);
  }

  /** Admin and board edit the meeting types (with step-up). */
  canEditTypes(): boolean {
    return this.session.hasRole(...ADMIN_BOARD);
  }
}
