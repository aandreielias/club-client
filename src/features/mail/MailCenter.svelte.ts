import type { EventBus } from '../../lib/bus';
import { Resource } from '../../lib/state/Resource.svelte';
import { MAIL_RECEIVED } from './events';
import type { MailApi } from './MailApi';
import type { Mailbox } from './model';

/**
 * The member's mailboxes with their unread counts, shared by the sidebar badge and the mail page.
 * Loads once per session and reloads when the server announces new mail.
 */
export class MailCenter {
  readonly mailboxes: Resource<Mailbox[]>;
  readonly unread: number;

  constructor(
    private readonly api: MailApi,
    private readonly bus: EventBus,
  ) {
    this.mailboxes = new Resource(() => this.api.mailboxes());
    this.unread = $derived((this.mailboxes.value ?? []).reduce((sum, box) => sum + box.unread, 0));
  }

  /** Session hook: initial load plus live refresh; returns the cleanup. */
  start(): () => void {
    void this.mailboxes.load();
    const subscription = this.bus.subscribe(MAIL_RECEIVED, () => void this.mailboxes.load());
    return () => {
      subscription.unsubscribe();
      this.mailboxes.set([]);
    };
  }
}
