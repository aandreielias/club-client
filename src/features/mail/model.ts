// Types of the mail endpoints (server: MailApi).

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

export interface OutgoingMail {
  to: string[];
  cc: string[];
  subject: string;
  body: string;
}
