import { settings } from '../../settings';
import type { MessageCatalog } from '../../lib/errors/ErrorMessages';

const limits = settings.calendar;

export const CALENDAR_MESSAGES: MessageCatalog = {
  'appointment.not-found': 'Termin nicht gefunden.',
  'appointment.type-missing': 'Bitte eine Art auswählen.',
  'appointment.title-invalid': `Titel mit 1 bis ${limits.titleMaxLength} Zeichen angeben.`,
  'appointment.description-too-long': `Die Beschreibung hat höchstens ${limits.descriptionMaxLength} Zeichen.`,
  'appointment.location-too-long': `Der Ort hat höchstens ${limits.locationMaxLength} Zeichen.`,
  'appointment.location-unknown': 'Diesen Ort gibt es nicht mehr. Bitte einen anderen wählen.',
  'appointment.cabin-too-long': `Eine Kabine hat höchstens ${settings.calendar.cabinMaxLength} Zeichen.`,
  'appointment.cabin-not-allowed': 'Bei Besprechungen gibt es keine Kabinen. Kabinen leeren oder eine andere Art wählen.',
  'appointment.times-invalid': 'Das Ende muss nach dem Beginn liegen.',
  'appointment.too-long': `Ein Termin dauert höchstens ${limits.maxDurationDays} Tage.`,
  'appointment.repeat-until-invalid': 'Das Ende der Serie muss am oder nach dem ersten Termin liegen.',
  'appointment.interval-invalid': `Der Abstand muss 1 bis ${limits.maxIntervalWeeks} Wochen sein.`,
  'appointment.series-too-long': `Eine Serie hat höchstens ${limits.maxSeriesOccurrences} Termine.`,
  'attendance.appointment-cancelled': 'Der Termin ist abgesagt.',
  'attendance.closed': 'Der Termin hat schon begonnen. Antworten ist nicht mehr möglich.',
  'attendance.not-in-team': 'Nur Mitglieder des Teams können antworten.',
  'attendance.reason-too-long': `Die Begründung hat höchstens ${limits.reasonMaxLength} Zeichen.`,
  'attendance.status-missing': 'Bitte eine Antwort auswählen.',
  'calendar.range-invalid': `Der Zeitraum darf höchstens ${limits.maxRangeDays} Tage umfassen.`,
  'absence.not-found': 'Die Abwesenheit gibt es nicht mehr.',
  'absence.range-invalid': 'Das Ende der Abwesenheit liegt vor dem Beginn.',
  'absence.too-long': 'Die Abwesenheit ist zu lang.',
  'absence.reason-too-long': 'Der Grund ist zu lang (höchstens 300 Zeichen).',
  'ride.exists': 'Du fährst bereits mit eigenem Auto zu diesem Termin.',
  'ride.full': 'In diesem Auto ist kein Platz mehr frei.',
  'ride.is-driver': 'Fährt bereits mit eigenem Auto zu diesem Termin.',
  'ride.driver-is-passenger': 'Der Fahrer hat ohnehin einen Platz.',
  'ride.not-driver': 'Nur der Fahrer kann die Fahrt absagen.',
  'ride.not-found': 'Die Fahrt gibt es nicht mehr.',
  'ride.not-passenger': 'Nur Mitfahrer, ihre Eltern oder der Fahrer können das ändern.',
  'ride.note-too-long': 'Die Notiz ist zu lang (höchstens 200 Zeichen).',
  'ride.seats-invalid': 'Ungültige Anzahl freier Plätze.',
};
