// Types of the mail endpoints (server: MailApi).

import type { RefKind } from '../../lib/records/refs';
import type { Role } from '../../lib/types';

export type MailFolder = 'INBOX' | 'DRAFTS' | 'SENT' | 'TRASH';
type MailboxKind = 'PERSONAL' | 'SHARED';

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

/** Who reads a shared mailbox (server: MailApi.Owners): everyone with one of the roles, a running office (key) or coaching one of the teams, and the members named. */
export interface MailboxOwners {
  roles: Role[];
  offices: string[];
  teamIds: string[];
  memberIds: string[];
}

export const NO_OWNERS: MailboxOwners = { roles: [], offices: [], teamIds: [], memberIds: [] };

/** A club address for the recipient suggestions: personal (`memberId`) or shared (`owners`). */
export interface AddressEntry {
  address: string;
  name: string;
  memberId: string | null;
  owners: MailboxOwners;
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

/** A mailbox as admin and board manage it: personal (`memberId`) or shared (`owners`). */
export interface MailboxAdmin {
  id: string;
  address: string;
  name: string;
  memberId: string | null;
  memberName: string | null;
  owners: MailboxOwners;
}

export interface MailboxInput {
  address: string;
  name: string;
  memberId: string | null;
  owners: MailboxOwners | null;
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
  /** Pass as `before` for older mails; null on the last page. */
  nextBefore: string | null;
}

/** The club's mail domain (every mailbox address ends with it; null until set) and recipients per member and day. */
export interface MailSettings {
  domain: string | null;
  dailyLimit: number;
  /** false while the server runs without a mail provider: club mail is not kept (read-only, ignored on save). */
  keepsMail: boolean;
  /** Who gets a personal mailbox automatically: everyone with a login, club members only, or nobody (admins assign by hand). */
  personalFor: PersonalFor;
  /** How personal addresses are built. */
  addressPattern: AddressPattern;
  /** Recipients of one mail, 1 to `dailyLimit`. */
  maxRecipients: number;
}

type PersonalFor = 'ALL' | 'CLUB_MEMBERS' | 'NONE';

export type AddressPattern = 'FIRSTLAST' | 'FIRST_DOT_LAST' | 'INITIAL_DOT_LAST';

export const ADDRESS_PATTERNS: { value: AddressPattern; label: string }[] = [
  { value: 'FIRSTLAST', label: 'vornamenachname@' },
  { value: 'FIRST_DOT_LAST', label: 'vorname.nachname@' },
  { value: 'INITIAL_DOT_LAST', label: 'v.nachname@' },
];

const ascii = (name: string): string =>
  name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[^a-z0-9]/g, '');

/** server: MailSettings.personalAddress — "Jürgen Groß" → "juergengross", "juergen.gross" or "j.gross", ASCII only. */
export function personalLocal(firstName: string, lastName: string, pattern: AddressPattern = 'FIRSTLAST'): string {
  const first = ascii(firstName);
  const last = ascii(lastName);
  const local =
    !first || !last
      ? ascii(`${firstName} ${lastName}`)
      : pattern === 'FIRST_DOT_LAST'
        ? `${first}.${last}`
        : pattern === 'INITIAL_DOT_LAST'
          ? `${first[0]}.${last}`
          : first + last;
  return local || 'mitglied';
}
