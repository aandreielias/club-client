import type { SessionStore } from '../../lib/session/SessionStore.svelte';
import { ADMIN_BOARD, type Member, type Role } from '../../lib/types';

/** GUEST comes from a tournament's teams, BOARD from a Vorstand office (server: member.board-by-office). */
const ALL_ROLES: readonly Role[] = ['ADMIN', 'COACH', 'PLAYER', 'PARENT', 'VOLUNTEER'];

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

  /** server: MemberHandlers.updateProfile — admin/board, and guardians for their wards (phone, photo consent, a missing birth date). */
  canEditProfile(member: Member): boolean {
    return member.active && (this.isManager || this.isGuardianOf(member));
  }

  /** Names and a set birth date: admin/board only; everyone else through a change request (member.change-needs-request). */
  canEditNames(): boolean {
    return this.isManager;
  }

  isGuardianOf(member: Member): boolean {
    return this.session.wardIds.includes(member.id);
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

  /** server: MembershipHandlers.setMembership */
  canSetMembership(member: Member): boolean {
    return this.isManager && member.active;
  }

  /** server: MembershipHandlers.assign / end (with step-up) */
  canManageOffices(): boolean {
    return this.isManager;
  }

  canLinkGuardian(member: Member): boolean {
    return this.isManager && member.active;
  }

  canResetSecurity(): boolean {
    return this.isAdmin;
  }
}
