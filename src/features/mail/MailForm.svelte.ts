import { FormState } from '../../lib/state/FormState.svelte';
import { settings } from '../../settings';
import type { Mail, OutgoingMail } from './model';

export type MailField = 'from' | 'to' | 'cc' | 'subject' | 'body';

const limits = settings.mail;
// Same rule as the server (mail.domain.Addresses): ASCII, stored lower case.
const ADDRESS = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;

/** A mail being written; reply and forward prefill it from a received mail. Errors show after the first submit. */
export class MailForm extends FormState<Partial<Record<MailField, string>>> {
  mailboxId = $state('');
  to = $state('');
  cc = $state('');
  subject = $state('');
  body = $state('');

  static reply(mail: Mail, mailboxId: string, all = false): MailForm {
    const form = new MailForm();
    form.mailboxId = mailboxId;
    form.to = mail.from;
    if (all) form.cc = [...mail.to, ...mail.cc].join(', ');
    form.subject = MailForm.prefixed('AW', mail.subject);
    form.body = `\n\n${MailForm.quoteHeader(mail)}\n${mail.body
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n')}`;
    return form;
  }

  static forward(mail: Mail, mailboxId: string): MailForm {
    const form = new MailForm();
    form.mailboxId = mailboxId;
    form.subject = MailForm.prefixed('WG', mail.subject);
    form.body = `\n\n---------- Weitergeleitete Nachricht ----------\n${MailForm.quoteHeader(mail)}\nAn: ${mail.to.join(', ')}\n\n${mail.body}`;
    return form;
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

  toMail(): OutgoingMail {
    const to = MailForm.addresses(this.to);
    return {
      to,
      cc: MailForm.addresses(this.cc).filter((a) => !to.includes(a)),
      subject: this.subject.trim(),
      body: this.body.trimEnd(),
    };
  }

  protected validate(): Partial<Record<MailField, string>> {
    const errors: Partial<Record<MailField, string>> = {};
    const mail = this.toMail();
    if (!this.mailboxId) errors.from = 'Absender-Postfach wählen.';
    if (!mail.to.length) errors.to = 'Mindestens einen Empfänger angeben.';
    else if (mail.to.some((a) => !ADDRESS.test(a))) errors.to = 'Keine gültige E-Mail-Adresse (ohne Umlaute vor dem @).';
    if (mail.cc.some((a) => !ADDRESS.test(a))) errors.cc = 'Keine gültige E-Mail-Adresse (ohne Umlaute vor dem @).';
    if (mail.to.length + mail.cc.length > limits.maxRecipients) errors.to = `Höchstens ${limits.maxRecipients} Empfänger.`;
    if (!mail.subject || mail.subject.length > limits.subjectMaxLength) errors.subject = `Betreff mit 1 bis ${limits.subjectMaxLength} Zeichen.`;
    if (mail.body.length > limits.bodyMaxLength) errors.body = `Höchstens ${limits.bodyMaxLength} Zeichen.`;
    return errors;
  }

  private static prefixed(prefix: string, subject: string): string {
    return new RegExp(`^${prefix}:`, 'i').test(subject) ? subject : `${prefix}: ${subject}`;
  }

  private static quoteHeader(mail: Mail): string {
    return `Von: ${mail.fromName} <${mail.from}>\nGesendet: ${new Date(mail.sentAt).toLocaleString('de-AT')}\nBetreff: ${mail.subject}`;
  }
}
