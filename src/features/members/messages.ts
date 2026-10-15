import { settings } from '../../settings';
import type { MessageCatalog } from '../../lib/errors/ErrorMessages';

const limits = settings.members;

export const MEMBER_MESSAGES: MessageCatalog = {
  'member.email-invalid': 'Ungültige E-Mail-Adresse (vor dem @ keine Umlaute, Domains mit ß werden nicht unterstützt).',
  'member.email-taken': 'Zu dieser E-Mail-Adresse gibt es schon ein Mitglied.',
  'member.first-name-invalid': `Vorname mit 1 bis ${limits.nameMaxLength} Zeichen angeben.`,
  'member.last-name-invalid': `Nachname mit 1 bis ${limits.nameMaxLength} Zeichen angeben.`,
  'member.cannot-deactivate-self': 'Du kannst dich nicht selbst deaktivieren.',
  'member.cannot-remove-own-admin': 'Die eigene Admin-Rolle lässt sich nicht entfernen.',
  'member.guardian-is-self': 'Ein Mitglied kann nicht sein eigener Erziehungsberechtigter sein.',
  'request.confirmation-missing': `Zur Bestätigung genau „${limits.resetAllConfirmation}“ eingeben.`,
};
