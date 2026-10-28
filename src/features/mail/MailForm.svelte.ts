import type { LinkedRef } from '../../lib/records/refs';
import { RefList } from '../../lib/records/RefList.svelte';
import { FormState } from '../../lib/state/FormState.svelte';
import { settings } from '../../settings';
import type { DraftInput, Mail, Mailbox, OutgoingMail } from './model';

export type MailField = 'from' | 'to' | 'cc' | 'bcc' | 'subject' | 'body';

const limits = settings.mail;
// Same rule as the server (mail.domain.Addresses): ASCII, stored lower case.
const ADDRESS = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;

const escape = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Plain text as paragraphs (mails without formatting, quoted in a reply). */
export const textToHtml = (text: string): string =>
  text
    .split(/\n{2,}/)
    .map((block) => `<p>${escape(block).replace(/\n/g, '<br>')}</p>`)
    .join('');

/**
 * A mail being written: sender mailbox, To/Cc/Bcc, subject, formatted text with the mailbox's signature, attached records; reply and
 * forward prefill it, a draft restores it. Errors show after the first submit.
 */
export class MailForm extends FormState<Partial<Record<MailField, string>>> {
  mailboxId = $state('');
  to = $state<string[]>([]);
  cc = $state<string[]>([]);
  bcc = $state<string[]>([]);
  showCc = $state(false);
  showBcc = $state(false);
  subject = $state('');
  html = $state('');
  /** The draft this mail is saved as, once saved. */
  draftId = $state<string | null>(null);
  /** Records attached below the text. */
  readonly links = new RefList(limits.maxRefs);
  /** The text as first filled in, and what follows the signature: while untouched, another sender swaps the signature. */
  #initialHtml = '';
  #rest = '';

  /** A new mail from `mailbox`, with its signature. */
  static compose(mailbox: Mailbox | undefined): MailForm {
    const form = new MailForm();
    form.mailboxId = mailbox?.id ?? '';
    form.start(mailbox, '');
    return form;
  }

  static reply(mail: Mail, mailbox: Mailbox | undefined, all = false): MailForm {
    const form = new MailForm();
    form.mailboxId = mailbox?.id ?? '';
    form.to = [mail.from];
    if (all) {
      const own = mailbox?.address;
      form.cc = [...mail.to, ...mail.cc].filter((a) => a !== own && a !== mail.from);
      form.showCc = form.cc.length > 0;
    }
    form.subject = MailForm.prefixed('AW', mail.subject);
    const quote = `<p>Am ${MailForm.when(mail)} schrieb ${escape(mail.fromName)} &lt;${escape(mail.from)}&gt;:</p><blockquote>${MailForm.content(mail)}</blockquote>`;
    form.start(mailbox, quote);
    return form;
  }

  static forward(mail: Mail, mailbox: Mailbox | undefined): MailForm {
    const form = new MailForm();
    form.mailboxId = mailbox?.id ?? '';
    form.subject = MailForm.prefixed('WG', mail.subject);
    const header =
      `<p>---------- Weitergeleitete Nachricht ----------<br>Von: ${escape(mail.fromName)} &lt;${escape(mail.from)}&gt;<br>` +
      `Gesendet: ${MailForm.when(mail)}<br>Betreff: ${escape(mail.subject)}<br>An: ${escape(mail.to.join(', '))}</p>`;
    form.start(mailbox, header + MailForm.content(mail));
    return form;
  }

  /** A saved draft, to write on. */
  static fromDraft(mail: Mail, mailboxId: string): MailForm {
    const form = new MailForm();
    form.mailboxId = mailboxId;
    form.draftId = mail.id;
    form.to = [...mail.to];
    form.cc = [...mail.cc];
    form.bcc = [...mail.bcc];
    form.showCc = mail.cc.length > 0;
    form.showBcc = mail.bcc.length > 0;
    form.subject = mail.subject;
    mail.refs.forEach((ref: LinkedRef) => form.links.addRef({ kind: ref.kind, id: ref.id, title: ref.title }));
    form.html = mail.html ?? textToHtml(mail.body);
    return form;
  }

  /** Another sender: while the text is untouched it gets that mailbox's signature instead. */
  chooseMailbox(mailbox: Mailbox): void {
    this.mailboxId = mailbox.id;
    if (this.html === this.#initialHtml && !this.draftId) this.start(mailbox, this.#rest);
  }

  /** "a@b.at, c@d.at; e@f.at" → clean, lower-case addresses without duplicates. */
  static addresses(text: string): string[] {
    return [
      ...new Set(
        text
          .split(/[,;\s]+/)
          .map((a) => a.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
  }

  static valid(address: string): boolean {
    return ADDRESS.test(address);
  }

  /** What a draft keeps: as typed, nothing checked. */
  toDraft(): DraftInput {
    return {
      to: [...this.to],
      cc: [...this.cc],
      bcc: [...this.bcc],
      subject: this.subject.trim(),
      html: this.html,
      refs: this.links.refs.map(({ kind, id }) => ({ kind, id })),
    };
  }

  toMail(): OutgoingMail {
    const to = [...new Set(this.to)];
    const cc = this.cc.filter((a) => !to.includes(a));
    return { ...this.toDraft(), to, cc, bcc: this.bcc.filter((a) => !to.includes(a) && !cc.includes(a)), draftId: this.draftId };
  }

  protected validate(): Partial<Record<MailField, string>> {
    const errors: Partial<Record<MailField, string>> = {};
    const invalid = 'Keine gültige E-Mail-Adresse (ohne Umlaute vor dem @).';
    if (!this.mailboxId) errors.from = 'Absender-Postfach wählen.';
    if (!this.to.length) errors.to = 'Mindestens einen Empfänger angeben.';
    else if (!this.to.every(MailForm.valid)) errors.to = invalid;
    if (!this.cc.every(MailForm.valid)) errors.cc = invalid;
    if (!this.bcc.every(MailForm.valid)) errors.bcc = invalid;
    if (this.to.length + this.cc.length + this.bcc.length > limits.maxRecipients) errors.to = `Höchstens ${limits.maxRecipients} Empfänger.`;
    const subject = this.subject.trim();
    if (!subject || subject.length > limits.subjectMaxLength) errors.subject = `Betreff mit 1 bis ${limits.subjectMaxLength} Zeichen.`;
    if (this.html.length > limits.bodyMaxLength) errors.body = 'Der Text ist zu lang.';
    return errors;
  }

  private start(mailbox: Mailbox | undefined, rest: string): void {
    this.html = MailForm.signed(mailbox, rest);
    this.#initialHtml = this.html;
    this.#rest = rest;
  }

  /** An empty line to write in, the signature below "-- ", then what follows (quote, forwarded mail). */
  private static signed(mailbox: Mailbox | undefined, rest: string): string {
    const signature = mailbox?.signature ? `<p>-- </p>${mailbox.signature}` : '';
    return signature || rest ? `<p></p>${signature}${rest}` : '';
  }

  private static content(mail: Mail): string {
    return mail.html ?? textToHtml(mail.body);
  }

  private static when(mail: Mail): string {
    return new Date(mail.sentAt).toLocaleString('de-AT', { dateStyle: 'medium', timeStyle: 'short' });
  }

  private static prefixed(prefix: string, subject: string): string {
    return new RegExp(`^${prefix}:`, 'i').test(subject) ? subject : `${prefix}: ${subject}`;
  }
}
