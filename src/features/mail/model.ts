// Types of the mail endpoints (server: MailApi).

import type { RefKind } from '../../lib/records/refs';
import type { Role } from '../../lib/types';

export type MailFolder = 'INBOX' | 'DRAFTS' | 'SENT' | 'TRASH';
export type MailboxKind = 'PERSONAL' | 'SHARED';

export const MAIL_FOLDERS: readonly { value: MailFolder; label: string }[] = [
  { value: 'INBOX', label: 'Posteingang' },
  { value: 'DRAFTS', label: 'Entwürfe' },
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
  /** Formatted (HTML), added to new mails; null without one. */
  signature: string | null;
  /** The viewer may change the signature (own mailbox; shared ones: admin and board). */
  signatureEditable: boolean;
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

/** `body`: plain text; `html`: the formatted text, cleaned by the server (null for plain mails), linked records only as codes; `bcc` only on own copies. */
export interface Mail {
  id: string;
  folder: MailFolder;
  from: string;
  fromName: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  html: string | null;
  sentAt: string;
  read: boolean;
}

/** A club address for the recipient suggestions: personal (`memberId`) or shared by a role. */
export interface AddressEntry {
  address: string;
  name: string;
  memberId: string | null;
  role: Role | null;
}

/**
 * A draft as typed (server: MailController.DraftBody); `html` may hold record chips (`<a data-ref="task:<id>">`), `refs` are attached
 * below the text. Sending adds the draft it came from (MailBody).
 */
export interface DraftInput {
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  html: string;
  refs: { kind: RefKind; id: string }[];
}

export interface OutgoingMail extends DraftInput {
  draftId: string | null;
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

/** A record linked in a mail by its code, as the reader sees it; not `visible`: unknown, or a record the reader may not open. */
export interface MailRef {
  code: string;
  visible: boolean;
  kind: RefKind | null;
  /** The id its window opens with (files `folderId:fileId`). */
  windowId: string | null;
  title: string | null;
}

/** A page of a folder, newest first; `next`: cursor of the following page, null on the last one. */
export interface MailPage {
  items: MailSummary[];
  next: string | null;
}

/** The club's mail domain (every mailbox address ends with it; null until set) and recipients per member and day. */
export interface MailSettings {
  domain: string | null;
  dailyLimit: number;
  /** false while the server runs without a mail provider: club mail is not kept (read-only, ignored on save). */
  keepsMail: boolean;
  /** Who gets a personal mailbox automatically: everyone with a login, club members only, or nobody (admins assign by hand). */
  personalFor: PersonalFor;
}

export type PersonalFor = 'ALL' | 'CLUB_MEMBERS' | 'NONE';

/** server: MailSettings.personalAddress — "Jürgen Groß" → "juergengross", ASCII only. */
export function personalLocal(firstName: string, lastName: string): string {
  return (
    `${firstName} ${lastName}`
      .toLowerCase()
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .normalize('NFD')
      .replace(/[^a-z0-9]/g, '') || 'mitglied'
  );
}
