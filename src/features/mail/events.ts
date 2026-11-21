// Live event types of the mail module (server: MailApi.MailReceived).

import { liveEvent } from '../../lib/live/LiveUpdates.svelte';

export const MAIL_RECEIVED = liveEvent<MailReceived>('mail.mail-received');
/** The club's mail settings changed (admin/board). */
export const MAIL_SETTINGS_CHANGED = liveEvent<Record<string, never>>('mail.settings-changed');

export interface MailReceived {
  mailboxId: string;
  /** The mail in that mailbox's inbox. */
  mailId: string;
  fromName: string;
  subject: string;
}
