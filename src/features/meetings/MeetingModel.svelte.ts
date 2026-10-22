import { Action } from '../../lib/state/Action.svelte';
import { Resource } from '../../lib/state/Resource.svelte';
import type { MeetingsApi } from './MeetingsApi';
import type { Meeting, PresenceMode } from './model';

/** One meeting and the writes of whoever runs it; every write answers with the whole meeting. */
export class MeetingModel {
  readonly meeting: Resource<Meeting>;
  readonly action = new Action();

  constructor(
    private readonly api: MeetingsApi,
    readonly id: string,
  ) {
    this.meeting = new Resource(() => this.api.get(this.id));
  }

  load(): Promise<void> {
    return this.meeting.load();
  }

  invite(): Promise<boolean> {
    return this.write(() => this.api.invite(this.id));
  }

  open(): Promise<boolean> {
    return this.write(() => this.api.open(this.id));
  }

  close(protocol: string): Promise<boolean> {
    return this.write(() => this.api.close(this.id, protocol));
  }

  saveProtocol(protocol: string): Promise<boolean> {
    return this.write(() => this.api.update(this.id, { protocol }));
  }

  setPresence(memberId: string, mode: PresenceMode | null): Promise<boolean> {
    return this.write(() => this.api.setPresence(this.id, memberId, mode));
  }

  delete(): Promise<boolean> {
    return this.action.run(() => this.api.delete(this.id));
  }

  private async write(request: () => Promise<Meeting>): Promise<boolean> {
    const updated = await this.action.attempt(request);
    if (updated) this.meeting.set(updated);
    return !!updated;
  }
}
