// Types of the mail endpoints (server: MailApi).

import type { RefKind } from '../../lib/records/refs';
import type { Role } from '../../lib/types';

export type MailFolder = 'INBOX' | 'SENT' | 'TRASH';
export type MailboxKind = 'PERSONAL' | 'SHARED';

export const MAIL_FOLDERS: readonly { value: MailFolder; label: string }[] = [
  { value: 'INBOX', label: 'Posteingang' },
  { value: 'SENT', label: 'Gesendet' },
  { value: 'TRASH', label: 'Papierkorb' },
];

/** A club address the member reads: their own, or a shared one of their role. */
export interface Mailbox {
  id: string;
  address: string;
  name: string;
  kind: MailboxKind;
  unread: number;
}

/** A mail in a folder list; `preview` is the start of the text on one line. */
export interface MailSummary {
  id: string;
  from: string;
  fromName: string;
  subject: string;
  preview: string;
  sentAt: string;
  read: boolean;
}

export interface Mail {
  id: string;
  folder: MailFolder;
  from: string;
  fromName: string;
  to: string[];
  cc: string[];
  subject: string;
  body: string;
  sentAt: string;
  read: boolean;
}

/** `body` may hold `[Titel](club:task/<id>)` markers; `refs` are attached below the text (server: MailController.MailBody). */
export interface OutgoingMail {
  to: string[];
  cc: string[];
  subject: string;
  body: string;
  refs: { kind: RefKind; id: string }[];
}

/** A mailbox as admin and board manage it: personal (`memberId`) or shared by everyone holding `role`. */
export interface MailboxAdmin {
  id: string;
  address: string;
  name: string;
  memberId: string | null;
  memberName: string | null;
  role: Role | null;
}

export interface MailboxInput {
  address: string;
  name: string;
  memberId: string | null;
  role: Role | null;
}
