import { settings } from '../../settings';
import type { MessageCatalog } from '../../lib/errors/ErrorMessages';

const limits = settings.mail;

export const MAIL_MESSAGES: MessageCatalog = {
  'mail.mailbox-not-found': 'Dieses Postfach gibt es nicht oder du hast keinen Zugriff mehr.',
  'mail.not-found': 'Diese E-Mail gibt es nicht mehr.',
  'mail.address-invalid': 'Mindestens eine Adresse ist keine gültige E-Mail-Adresse (ohne Umlaute vor dem @).',
  'mail.recipient-missing': 'Mindestens einen Empfänger angeben.',
  'mail.too-many-recipients': `Höchstens ${limits.maxRecipients} Empfänger.`,
  'mail.subject-invalid': `Betreff mit 1 bis ${limits.subjectMaxLength} Zeichen, ohne Zeilenumbruch.`,
  'mail.body-too-long': `Der Text hat höchstens ${limits.bodyMaxLength} Zeichen.`,
  'mail.mailbox-name-invalid': 'Der Name des Postfachs fehlt oder ist zu lang.',
  'mail.mailbox-owner-invalid': 'Ein Postfach gehört genau einem Mitglied oder einer Rolle.',
};
