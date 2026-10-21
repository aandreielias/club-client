import type { SessionStore } from '../../lib/session/SessionStore.svelte';
import { ADMIN_BOARD, type Member, type Role } from '../../lib/types';

/** GUEST is not granted here: guest accounts come from a tournament's teams. */
const ALL_ROLES: readonly Role[] = ['ADMIN', 'BOARD', 'COACH', 'PLAYER', 'PARENT', 'VOLUNTEER'];

/** Client-side mirror of MemberHandlers / SecurityHandlers; used only to show or hide actions. */
export class MemberPolicy {
  constructor(private readonly session: SessionStore) {}

  get isManager(): boolean {
    return this.session.hasRole(...ADMIN_BOARD);
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

  /** server: ChangeRequestHandlers.decide (with step-up) */
  canDecideChanges(): boolean {
    return this.isManager;
  }

  /** server: ChangeRequestHandlers.changeEmail */
  canChangeEmail(member: Member): boolean {
    return this.isManager && member.active;
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
  /** server: Member.isErased (no roles, no login, inactive); an erased record never comes back. */
  isErased(member: Member): boolean {
    return !member.active && member.roles.length === 0;
  }

  canReactivate(member: Member): boolean {
    return this.isManager && !member.active && !this.isErased(member) && (this.isAdmin || !member.roles.includes('ADMIN'));
  }

  /** server: MemberHandlers.erase, admin only, deactivated members only. */
  canErase(member: Member): boolean {
    return this.isAdmin && !member.active && !this.isErased(member);
  }

  canDeactivate(member: Member): boolean {
    return this.isManager && member.active && !this.isSelf(member) && (this.isAdmin || !member.roles.includes('ADMIN'));
  }

  canLinkGuardian(member: Member): boolean {
    return this.isManager && member.active;
  }

  canResetSecurity(): boolean {
    return this.isAdmin;
  }
}
