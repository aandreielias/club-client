import type { SessionStore } from '../../lib/session/SessionStore.svelte';
import { MANAGERS, type Member, type Role } from '../../lib/types';

const ALL_ROLES: readonly Role[] = ['ADMIN', 'BOARD', 'COACH', 'PLAYER', 'PARENT', 'VOLUNTEER'];

/** Client-side mirror of MemberHandlers / SecurityHandlers; used only to show or hide actions. */
export class MemberPolicy {
  constructor(private readonly session: SessionStore) {}

  get isManager(): boolean {
    return this.session.hasRole(...MANAGERS);
  }

  get isAdmin(): boolean {
    return this.session.hasRole('ADMIN');
  }

  isSelf(member: Member): boolean {
    return member.id === this.session.member.id;
  }

  canInvite(): boolean {
    return this.isManager;
  }

  /** Only admins grant ADMIN. */
  grantableRoles(): readonly Role[] {
    return this.isAdmin ? ALL_ROLES : ALL_ROLES.filter((r) => r !== 'ADMIN');
  }

  canEditProfile(member: Member): boolean {
    return this.isManager && member.active;
  }

  canSetRoles(member: Member): boolean {
    return this.isAdmin && member.active;
  }

  /** Never oneself; admins only by admins. */
  canDeactivate(member: Member): boolean {
    return this.isManager && member.active && !this.isSelf(member) && (this.isAdmin || !member.roles.includes('ADMIN'));
  }

  canLinkGuardian(member: Member): boolean {
    return this.isManager && member.active;
  }

  canResetPin(): boolean {
    return this.isAdmin;
  }

  canResetAll(): boolean {
    return this.isAdmin;
  }
}
