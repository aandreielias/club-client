import { settings } from '../../settings';
import type { MessageCatalog } from '../../lib/errors/ErrorMessages';

const limits = settings.tasks;

export const TASK_MESSAGES: MessageCatalog = {
  'task.not-found': 'Aufgabe nicht gefunden.',
  'task.title-invalid': `Titel mit 1 bis ${limits.titleMaxLength} Zeichen angeben.`,
  'task.description-too-long': `Die Beschreibung hat höchstens ${limits.descriptionMaxLength} Zeichen.`,
  'task.assignees-invalid': `1 bis ${limits.maxAssignees} Personen zuweisen.`,
  'task.assignee-unknown': 'Eine zugewiesene Person ist nicht (mehr) aktiv.',
  'task.assignee-not-in-team': 'Zugewiesene Personen müssen zum Team gehören.',
  'task.appointment-other-team': 'Der verknüpfte Termin gehört zu einem anderen Team.',
  'task.checklist-too-long': `Höchstens ${limits.maxChecklistItems} Punkte in der Checkliste.`,
  'task.checklist-item-invalid': `Checklistenpunkte mit 1 bis ${limits.checklistItemMaxLength} Zeichen angeben.`,
  'task.checklist-item-not-found': 'Der Checklistenpunkt existiert nicht mehr.',
  'task.due-conflict': 'Fälligkeit entweder setzen oder entfernen.',
  'task.range-invalid': 'Der Zeitraum ist ungültig.',
  'task.comment-invalid': `Kommentar mit 1 bis ${limits.commentMaxLength} Zeichen angeben.`,
};
