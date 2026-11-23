import { settings } from '../../settings';
import type { MessageCatalog } from '../../lib/errors/ErrorMessages';

const limits = settings.tasks;

export const TASK_MESSAGES: MessageCatalog = {
  'task.not-found': 'Aufgabe nicht gefunden.',
  'task-settings.invalid': 'Die Erinnerung liegt 1 bis 336 Stunden vor der Fälligkeit.',
  'task.title-invalid': `Titel mit 1 bis ${limits.titleMaxLength} Zeichen angeben.`,
  'task.description-too-long': `Die Beschreibung hat höchstens ${limits.descriptionMaxLength} Zeichen.`,
  'task.assignees-invalid': `1 bis ${limits.maxAssignees} Personen zuweisen.`,
  'task.assignee-unknown': 'Eine zugewiesene Person ist nicht (mehr) aktiv.',
  'task.assignee-not-in-team': 'Zugewiesene Personen müssen zum Team gehören.',
  'task.assignee-not-in-audience': 'Zugewiesene Personen müssen zu den gewählten Personen und Gruppen gehören.',
  'task.audience-invalid': 'Diese Auswahl an Personen und Gruppen geht so nicht.',
  'task.appointment-other-team': 'Der verknüpfte Termin gehört zu einem anderen Team.',
  'task.checklist-too-long': `Höchstens ${limits.maxChecklistItems} Punkte in der Checkliste.`,
  'task.checklist-item-invalid': `Checklistenpunkte mit 1 bis ${limits.checklistItemMaxLength} Zeichen angeben.`,
  'task.checklist-item-not-found': 'Der Checklistenpunkt existiert nicht mehr.',
  'task.due-conflict': 'Fälligkeit entweder setzen oder entfernen.',
  'task.range-invalid': 'Der Zeitraum ist ungültig.',
  'task.comment-invalid': `Kommentar mit 1 bis ${limits.commentMaxLength} Zeichen angeben.`,
  'task.repeat-invalid': 'Ungültiger Wiederholungs-Abstand.',
  'task.repeat-needs-due': 'Eine wiederkehrende Aufgabe braucht ein Fälligkeitsdatum.',
  'task.labels-invalid': 'Höchstens 10 Labels, nur aktive des Vereins.',
  'task.parent-invalid': 'Übergeordnet kann nur eine sichtbare Aufgabe ohne eigene übergeordnete sein; Aufgaben mit Unteraufgaben haben keine.',
  'task.blockers-invalid': 'Höchstens 20 sichtbare andere Aufgaben, auf die gewartet wird.',
  'task.blockers-cycle': 'Diese Aufgaben würden im Kreis aufeinander warten.',
  'task.stage-unknown': 'Diesen Status gibt es nicht (mehr).',
  'task-stage.invalid': 'Status mit Bezeichnung (1 bis 40 Zeichen), Farbe und Phase angeben.',
  'task-stage.not-found': 'Diesen Status gibt es nicht mehr.',
  'task-stage.in-use': 'Aufgaben stehen in diesem Status; archivieren statt löschen.',
  'task-stage.phase-fixed': 'Aufgaben stehen in diesem Status; seine Phase bleibt.',
  'task-stage.phase-empty': 'Jede Phase braucht mindestens einen aktiven Status.',
  'task-label.invalid': 'Label mit Bezeichnung (1 bis 40 Zeichen) und Farbe angeben.',
  'task-label.not-found': 'Dieses Label gibt es nicht mehr.',
  'task-label.in-use': 'Aufgaben tragen dieses Label; archivieren statt löschen.',
};
