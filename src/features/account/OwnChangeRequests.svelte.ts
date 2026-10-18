import { Action } from '../../lib/state/Action.svelte';
import { Resource } from '../../lib/state/Resource.svelte';
import type { ChangeField, ChangeRequest, MembersApi } from '../members/MembersApi';

/** The signed-in member's open change requests and sending a new one. */
export class OwnChangeRequests {
  readonly open: Resource<ChangeRequest[]>;
  readonly sendAction = new Action();

  constructor(private readonly api: MembersApi) {
    this.open = new Resource(() => this.api.ownChangeRequests());
  }

  load(): Promise<void> {
    return this.open.load();
  }

  pending(field: ChangeField): ChangeRequest | undefined {
    return this.open.value?.find((r) => r.field === field);
  }

  async send(field: ChangeField, value: string, note: string): Promise<boolean> {
    const ok = await this.sendAction.run(() => this.api.requestChange(field, value.trim(), note.trim() || null));
    if (ok) await this.load();
    return ok;
  }
}
