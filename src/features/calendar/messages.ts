import { settings } from '../../settings';
import type { MessageCatalog } from '../../lib/errors/ErrorMessages';

const limits = settings.calendar;

export const CALENDAR_MESSAGES: MessageCatalog = {
  'appointment.not-found': 'Termin nicht gefunden.',
  'appointment.type-missing': 'Bitte eine Art auswählen.',
  'appointment.title-invalid': `Titel mit 1 bis ${limits.titleMaxLength} Zeichen angeben.`,
  'appointment.description-too-long': `Die Beschreibung hat höchstens ${limits.descriptionMaxLength} Zeichen.`,
  'appointment.location-too-long': `Der Ort hat höchstens ${limits.locationMaxLength} Zeichen.`,
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
};
