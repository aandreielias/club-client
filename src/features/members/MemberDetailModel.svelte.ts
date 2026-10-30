import { Action } from '../../lib/state/Action.svelte';
import { Resource } from '../../lib/state/Resource.svelte';
import type { Member, Role } from '../../lib/types';
import type { Membership, MembersApi, ProfilePatch } from './MembersApi';

/** One member and the administrative actions on their page. */
export class MemberDetailModel {
  readonly member: Resource<Member>;
  readonly profileAction = new Action();
  readonly rolesAction = new Action();
  readonly membershipAction = new Action();
  readonly guardianAction = new Action();
  readonly resetAction = new Action();
  readonly deactivateAction = new Action();
  readonly reactivateAction = new Action();
  readonly eraseAction = new Action();
  readonly inviteAction = new Action();
  /** Invited and never signed in; loaded only for those who may invite. */
  readonly invitationPending: Resource<boolean>;

  constructor(
    private readonly api: MembersApi,
    readonly id: string,
  ) {
    this.member = new Resource(() => this.api.get(this.id));
    this.invitationPending = new Resource(async () => (await this.api.pendingInvitations()).includes(this.id));
  }

  /** The invitation mail again; for a member without a login the first one (then the member has a login, still pending). */
  async resendInvite(): Promise<boolean> {
    if (!(await this.inviteAction.run(() => this.api.resendInvite(this.id)))) return false;
    await Promise.all([this.member.load(), this.invitationPending.load()]);
    return true;
  }

  load(): Promise<void> {
    return this.member.load();
  }

  /** E-mail first (it may be taken), then the other changes, as one save. */
  saveProfile(patch: ProfilePatch, email: string | null = null): Promise<boolean> {
    return this.write(this.profileAction, async () => {
      const changed = email ? await this.api.changeEmail(this.id, email) : null;
      return Object.keys(patch).length || !changed ? this.api.update(this.id, patch) : changed;
    });
  }

  setRoles(roles: readonly Role[]): Promise<boolean> {
    return this.write(this.rolesAction, () => this.api.setRoles(this.id, roles));
  }

  setMembership(membership: Membership): Promise<boolean> {
    return this.write(this.membershipAction, () => this.api.setMembership(this.id, membership));
  }

  linkGuardian(guardianId: string): Promise<boolean> {
    return this.write(this.guardianAction, () => this.api.linkGuardian(this.id, guardianId));
  }

  resetSecurity(): Promise<boolean> {
    return this.resetAction.run(() => this.api.resetSecurity(this.id));
  }

  deactivate(): Promise<boolean> {
    return this.write(this.deactivateAction, () => this.api.deactivate(this.id));
  }

  reactivate(): Promise<boolean> {
    return this.write(this.reactivateAction, () => this.api.reactivate(this.id));
  }

  /** The record stays (anonymised); reload shows the erased state. */
  async erase(): Promise<boolean> {
    if (!(await this.eraseAction.run(() => this.api.erase(this.id)))) return false;
    await this.member.load();
    return true;
  }

  unlinkGuardian(guardianId: string): Promise<boolean> {
    return this.write(this.guardianAction, () => this.api.unlinkGuardian(this.id, guardianId));
  }

  private async write(action: Action, request: () => Promise<Member>): Promise<boolean> {
    const updated = await action.attempt(request);
    if (updated) this.member.set(updated);
    return !!updated;
  }
}
