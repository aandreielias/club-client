import { Action } from '../../lib/state/Action.svelte';
import { Resource } from '../../lib/state/Resource.svelte';
import type { MeetingsApi } from './MeetingsApi';
import type { RefKind } from '../../lib/records/refs';
import type { AgendaItemInput, Meeting, MeetingPatch } from './model';

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

  /** Place and video link, until the meeting closes. */
  /** A draft's title, urgency and times. */
  save(patch: MeetingPatch): Promise<boolean> {
    return this.write(() => this.api.update(this.id, patch));
  }

  /** The whole Tagesordnung with its Beschlüsse. */
  setAgenda(items: readonly AgendaItemInput[]): Promise<boolean> {
    return this.write(() => this.api.setAgenda(this.id, items));
  }

  setPresenceMany(memberIds: readonly string[], present: boolean): Promise<boolean> {
    return this.write(() => this.api.setPresenceMany(this.id, memberIds, present));
  }

  checkIn(): Promise<boolean> {
    return this.write(() => this.api.checkIn(this.id));
  }

  approveProtocol(): Promise<boolean> {
    return this.write(() => this.api.approveProtocol(this.id));
  }

  generateProtocol(): Promise<boolean> {
    return this.write(() => this.api.generateProtocol(this.id));
  }

  savePlace(patch: { location: string; videoUrl: string }): Promise<boolean> {
    return this.write(() => this.api.update(this.id, patch));
  }

  finalizeProtocol(): Promise<boolean> {
    return this.write(() => this.api.finalizeProtocol(this.id));
  }

  cancel(): Promise<boolean> {
    return this.write(() => this.api.cancel(this.id));
  }

  saveProtocol(protocol: string): Promise<boolean> {
    return this.write(() => this.api.update(this.id, { protocol }));
  }

  setPresence(memberId: string, present: boolean): Promise<boolean> {
    return this.write(() => this.api.setPresence(this.id, memberId, present));
  }

  generateInvitation(): Promise<boolean> {
    return this.write(() => this.api.generateInvitation(this.id));
  }

  setLinks(refs: readonly { kind: RefKind; id: string }[]): Promise<boolean> {
    return this.write(() => this.api.setLinks(this.id, refs));
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
