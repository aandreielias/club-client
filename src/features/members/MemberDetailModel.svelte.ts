import { Action } from '../../lib/state/Action.svelte';
import { Resource } from '../../lib/state/Resource.svelte';
import type { Member, Role } from '../../lib/types';
import type { MembersApi, ProfilePatch } from './MembersApi';

/** One member and the administrative actions on their page. */
export class MemberDetailModel {
  readonly member: Resource<Member>;
  readonly profileAction = new Action();
  readonly rolesAction = new Action();
  readonly guardianAction = new Action();
  readonly resetAction = new Action();
  readonly deactivateAction = new Action();

  constructor(
    private readonly api: MembersApi,
    readonly id: string,
  ) {
    this.member = new Resource(() => this.api.get(this.id));
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

  linkGuardian(guardianId: string): Promise<boolean> {
    return this.write(this.guardianAction, () => this.api.linkGuardian(this.id, guardianId));
  }

  resetSecurity(): Promise<boolean> {
    return this.resetAction.run(() => this.api.resetSecurity(this.id));
  }

  deactivate(): Promise<boolean> {
    return this.write(this.deactivateAction, () => this.api.deactivate(this.id));
  }

  private async write(action: Action, request: () => Promise<Member>): Promise<boolean> {
    let updated: Member | null = null;
    const ok = await action.run(async () => {
      updated = await request();
    });
    if (updated) this.member.set(updated);
    return ok;
  }
}
