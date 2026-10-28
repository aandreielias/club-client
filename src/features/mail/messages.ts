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
  'mail.mailbox-owner-invalid': 'Ein Postfach gehört genau einem Mitglied oder einer Rolle (nicht Gast).',
  'mail.member-unknown': 'Dieses Mitglied gibt es nicht oder es ist nicht aktiv.',
  'mail.member-has-mailbox': 'Dieses Mitglied hat schon ein persönliches Postfach.',
  'mail.address-taken': 'Diese Adresse hat schon ein anderes Postfach.',
  'mail.too-many-refs': `Höchstens ${limits.maxRefs} verlinkte Einträge pro E-Mail.`,
  'mail.ref-unknown': 'Ein verlinkter Eintrag existiert nicht mehr oder ist für dich nicht sichtbar.',
};
