import type { MessageCatalog } from '../../lib/errors/ErrorMessages';

export const MEETING_MESSAGES: MessageCatalog = {
  'meeting.not-found': 'Sitzung nicht gefunden.',
  'meeting.title-invalid': 'Titel mit 1 bis 120 Zeichen angeben.',
  'meeting.agenda-too-long': 'Die Tagesordnung hat höchstens 4000 Zeichen.',
  'meeting.urgency-invalid': 'Eine außerordentliche Vorstandssitzung braucht einen Grund der Dringlichkeit (§ 10 Abs. 3), andere Sitzungen keinen.',
  'meeting.location-too-long': 'Der Ort hat höchstens 200 Zeichen.',
  'meeting.video-url-invalid': 'Der Videolink beginnt mit https://.',
  'meeting.times-invalid': 'Das Ende liegt nach dem Beginn.',
  'meeting.too-long': 'Eine Sitzung dauert höchstens einen Tag.',
  'meeting.protocol-too-long': 'Das Protokoll hat höchstens 20000 Zeichen.',
  'meeting.may-not-convene': 'Diese Sitzung beruft der Vorsitz (oder die Stellvertretung) ein.',
  'meeting.notice-too-short': 'Für diese Sitzung ist die Einladungsfrist nicht mehr einzuhalten. Bitte den Termin verschieben.',
  'meeting.already-invited': 'Zu dieser Sitzung wurde schon eingeladen.',
  'meeting.invited-time-fixed': 'Nach der Einladung bleibt der Termin fest. Für einen neuen Termin neu einladen.',
  'meeting.not-invited': 'Zuerst einladen.',
  'meeting.not-open': 'Das Protokoll wird während der Sitzung geschrieben.',
  'meeting.closed': 'Die Sitzung ist beendet.',
  'meeting.not-draft': 'Nur Entwürfe lassen sich löschen.',
  'meeting.not-voter': 'Nur stimmberechtigte Mitglieder zählen als anwesend.',
};
