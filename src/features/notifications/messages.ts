import { settings } from '../../settings';
import type { MessageCatalog } from '../../lib/errors/ErrorMessages';

const limits = settings.notifications.message;

export const NOTIFICATION_MESSAGES: MessageCatalog = {
  'notifications.preferences-missing': 'Die Einstellungen fehlen.',
  'notifications.kind-missing': 'Eine Benachrichtigungsart fehlt.',
  'notifications.push-token-invalid': 'Das Gerät konnte nicht für Push registriert werden.',
  'message.title-invalid': `Titel mit 1 bis ${limits.titleMaxLength} Zeichen angeben.`,
  'message.body-too-long': `Der Text hat höchstens ${limits.bodyMaxLength} Zeichen.`,
  'message.recipients-missing': 'Die Nachricht erreicht niemanden.',
  'message.member-unknown': 'Eine ausgewählte Person ist nicht mehr aktiv.',
  'message.too-many-targets': `Höchstens ${limits.maxTargets} Teams und Personen auswählen.`,
  'message.too-many-refs': `Höchstens ${limits.maxRefs} Verknüpfungen.`,
  'message.ref-unknown': 'Eine Verknüpfung gibt es nicht mehr oder du kannst sie nicht öffnen.',
};
