import { FormState } from '../../lib/state/FormState.svelte';
import type { RecordRef } from '../../lib/records/RecordDrag';
import { RefList, type PickedRef } from '../../lib/records/RefList.svelte';
import type { RefKind } from '../../lib/records/refs';
import { settings } from '../../settings';
import type { OutgoingMessage } from './model';

export { DROPPABLE } from '../../lib/records/refs';

export type Audience = 'everyone' | 'teams' | 'people';
export type MessageField = 'title' | 'body' | 'recipients' | 'refs';

const limits = settings.notifications.message;

/** A message being written: recipients, text and linked records. Errors show after the first submit. */
export class MessageForm extends FormState<Partial<Record<MessageField, string>>> {
  audience = $state<Audience>('teams');
  teamIds = $state<string[]>([]);
  memberIds = $state<string[]>([]);
  includeGuardians = $state(true);
  title = $state('');
  body = $state('');
  readonly links = new RefList(limits.maxRefs);

  constructor(readonly mayWriteEveryone: boolean) {
    super();
  }

  /** Whether anyone is chosen at all (else the preview stays empty). */
  get hasTargets(): boolean {
    return this.audience === 'everyone' || (this.audience === 'teams' ? this.teamIds.length > 0 : this.memberIds.length > 0);
  }

  toggleTeam(id: string): void {
    this.teamIds = this.teamIds.includes(id) ? this.teamIds.filter((t) => t !== id) : [...this.teamIds, id];
  }

  toggleMember(id: string): void {
    this.memberIds = this.memberIds.includes(id) ? this.memberIds.filter((m) => m !== id) : [...this.memberIds, id];
  }

  get refs(): readonly PickedRef[] {
    return this.links.refs;
  }

  hasRef(kind: RefKind, id: string): boolean {
    return this.links.hasRef(kind, id);
  }

  addRef(ref: PickedRef): void {
    this.links.addRef(ref);
  }

  /** A record dropped onto the message; false when it cannot be linked (kind, duplicate, limit). */
  addRecord(record: RecordRef): boolean {
    return this.links.addRecord(record);
  }

  removeRef(ref: PickedRef): void {
    this.links.removeRef(ref);
  }

  toMessage(): OutgoingMessage {
    return {
      title: this.title.trim(),
      body: this.body.trim(),
      everyone: this.audience === 'everyone',
      teamIds: this.audience === 'teams' ? [...this.teamIds] : [],
      memberIds: this.audience === 'people' ? [...this.memberIds] : [],
      includeGuardians: this.includeGuardians,
      refs: this.refs.map(({ kind, id }) => ({ kind, id })),
    };
  }

  protected validate(): Partial<Record<MessageField, string>> {
    const errors: Partial<Record<MessageField, string>> = {};
    const title = this.title.trim();
    if (!title || title.length > limits.titleMaxLength) errors.title = `Titel mit 1 bis ${limits.titleMaxLength} Zeichen.`;
    if (this.body.trim().length > limits.bodyMaxLength) errors.body = `Höchstens ${limits.bodyMaxLength} Zeichen.`;
    if (!this.hasTargets) errors.recipients = this.audience === 'teams' ? 'Mindestens ein Team auswählen.' : 'Mindestens eine Person auswählen.';
    if (this.audience === 'everyone' && !this.mayWriteEveryone) errors.recipients = 'Nur Admin und Vorstand schreiben an alle.';
    if (this.teamIds.length + this.memberIds.length > limits.maxTargets) errors.recipients = `Höchstens ${limits.maxTargets} Teams und Personen.`;
    return errors;
  }
}
