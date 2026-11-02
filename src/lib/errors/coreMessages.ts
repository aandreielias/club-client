import type { MessageCatalog } from './ErrorMessages';

export const STATUS_MESSAGES: Readonly<Record<number, string>> = {
  0: 'Server nicht erreichbar. Bitte Verbindung prüfen.',
  400: 'Die Eingaben sind ungültig.',
  401: 'Bitte neu anmelden.',
  403: 'Dafür fehlt die Berechtigung.',
  404: 'Nicht gefunden.',
  409: 'Die Daten wurden inzwischen geändert.',
  429: 'Zu viele Anfragen. Bitte kurz warten.',
  500: 'Fehler auf dem Server. Bitte später erneut versuchen.',
  503: 'Dienst vorübergehend nicht verfügbar.',
};

export const UNKNOWN_MESSAGE = 'Unbekannter Fehler.';

/** Codes shared by every feature (gateway, login, profile). */
export const CORE_MESSAGES: MessageCatalog = {
  'audit.area-invalid': 'Unbekannter Bereich im Protokoll.',
  network: 'Server nicht erreichbar. Bitte Verbindung prüfen.',
  timeout: 'Der Server antwortet nicht rechtzeitig. Bitte erneut versuchen.',
  'access.denied': 'Dafür fehlt die Berechtigung.',
  'data.conflict': 'Die Daten wurden inzwischen geändert oder hängen von anderen ab.',
  'request.invalid': 'Die Eingaben sind ungültig.',
  'request.too-large': 'Die Anfrage ist zu groß.',
  'idempotency.in-progress': 'Die Anfrage wird noch verarbeitet.',
  'auth.unknown-member': 'Zu diesem Login gibt es kein aktives Mitglied.',
  'profile.birth-date-required': 'Bitte zuerst das Geburtsdatum eintragen.',
  'member.not-found': 'Mitglied nicht gefunden.',
  'team.not-found': 'Team nicht gefunden.',
  'member.birth-date-in-future': 'Das Geburtsdatum liegt in der Zukunft.',
  'member.birth-date-invalid': 'Das Geburtsdatum ist ungültig.',
  'member.phone-invalid': 'Die Telefonnummer ist ungültig.',
  'auth.required': 'Bitte neu anmelden.',
  'idempotency.key-reused': 'Die Anfrage wurde schon mit anderen Daten gesendet. Bitte neu laden.',
};
