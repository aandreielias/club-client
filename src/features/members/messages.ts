import { settings } from '../../settings';
import type { MessageCatalog } from '../../lib/errors/ErrorMessages';

const limits = settings.members;

export const MEMBER_MESSAGES: MessageCatalog = {
  'member.email-invalid': 'Ungültige E-Mail-Adresse (vor dem @ keine Umlaute, Domains mit ß werden nicht unterstützt).',
  'member.email-taken': 'Zu dieser E-Mail-Adresse gibt es schon ein Mitglied.',
  'member.change-needs-request': 'Namen und Geburtsdatum bitte über einen Änderungsantrag ändern.',
  'member.first-name-invalid': `Vorname mit 1 bis ${limits.nameMaxLength} Zeichen angeben.`,
  'member.last-name-invalid': `Nachname mit 1 bis ${limits.nameMaxLength} Zeichen angeben.`,
  'member.cannot-deactivate-self': 'Du kannst dich nicht selbst deaktivieren.',
  'member.cannot-remove-own-admin': 'Die eigene Admin-Rolle lässt sich nicht entfernen.',
  'member.guardian-is-self': 'Ein Mitglied kann nicht sein eigener Erziehungsberechtigter sein.',
  'change-request.open-exists': 'Für diese Angabe läuft schon eine Anfrage.',
  'change-request.value-missing': 'Bitte die neue Angabe eintragen.',
  'change-request.note-too-long': `Begründung mit höchstens ${limits.changeNoteMaxLength} Zeichen.`,
  'change-request.decided': 'Über diese Anfrage wurde schon entschieden.',
  'change-request.not-found': 'Diese Anfrage gibt es nicht mehr.',
};
