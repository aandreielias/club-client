import { settings } from '../../settings';
import type { MessageRef, OutgoingMessage, RefKind } from './model';

export type Audience = 'everyone' | 'teams' | 'people';
export type MessageField = 'title' | 'body' | 'recipients' | 'refs';

const limits = settings.notifications.message;

/** A message being written: recipients, text and linked records. Errors show after the first submit. */
export class MessageForm {
  audience = $state<Audience>('teams');
  teamIds = $state<string[]>([]);
  memberIds = $state<string[]>([]);
  includeGuardians = $state(true);
  title = $state('');
  body = $state('');
  refs = $state<Omit<MessageRef, 'parentId'>[]>([]);
  submitted = $state(false);

  readonly errors: Partial<Record<MessageField, string>>;
  readonly valid: boolean;

  constructor(readonly mayWriteEveryone: boolean) {
    this.errors = $derived(this.validate());
    this.valid = $derived(Object.keys(this.errors).length === 0);
  }

  error(field: MessageField): string | null {
    return this.submitted ? (this.errors[field] ?? null) : null;
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

  hasRef(kind: RefKind, id: string): boolean {
    return this.refs.some((r) => r.kind === kind && r.id === id);
  }

  addRef(ref: Omit<MessageRef, 'parentId'>): void {
    if (!this.hasRef(ref.kind, ref.id) && this.refs.length < limits.maxRefs) this.refs = [...this.refs, ref];
  }

  removeRef(ref: Omit<MessageRef, 'parentId'>): void {
    this.refs = this.refs.filter((r) => !(r.kind === ref.kind && r.id === ref.id));
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

  private validate(): Partial<Record<MessageField, string>> {
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
