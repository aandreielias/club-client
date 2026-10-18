import { Action } from '../../lib/state/Action.svelte';
import { Resource } from '../../lib/state/Resource.svelte';
import type { ChangeRequest, MembersApi } from './MembersApi';

/** One change request as admin/board decide it (shown inside the request's task). */
export class ChangeRequestModel {
  readonly request: Resource<ChangeRequest>;
  readonly decideAction = new Action();

  constructor(
    private readonly api: MembersApi,
    readonly id: string,
  ) {
    this.request = new Resource(() => this.api.changeRequest(id));
  }

  load(): Promise<void> {
    return this.request.load();
  }

  /** Resolves true when decided; the answer replaces the shown request. */
  decide(approve: boolean): Promise<boolean> {
    return this.decideAction.run(async () => this.request.set(await this.api.decideChange(this.id, approve)));
  }
}
