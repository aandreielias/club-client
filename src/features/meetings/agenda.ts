import type { AgendaItemInput, Majority, Meeting, Resolution } from './model';
import { settings } from '../../settings';

/**
 * One row of the Tagesordnung being edited: a plain item, or a Beschluss with its motion (text, majority, who carries it out, by when).
 * `locked`: its Beschluss was voted on already; it stays as it is (server: meeting.agenda-motion-voted).
 */
export interface AgendaRow {
  key: number;
  id: string | null;
  title: string;
  note: string;
  resolutionId: string | null;
  beschluss: boolean;
  locked: boolean;
  text: string;
  majority: Majority | null;
  assigneeIds: string[];
  implementDue: string;
}

let nextKey = 1;

export function emptyRow(beschluss = false): AgendaRow {
  return {
    key: nextKey++,
    id: null,
    title: '',
    note: '',
    resolutionId: null,
    beschluss,
    locked: false,
    text: '',
    majority: null,
    assigneeIds: [],
    implementDue: '',
  };
}

/** The meeting's agenda as rows; a Beschluss carries its resolution's motion. */
export function rowsOf(meeting: Meeting, resolutions: readonly Resolution[]): AgendaRow[] {
  return meeting.agendaItems.map((item) => {
    const r = item.resolutionId ? resolutions.find((x) => x.id === item.resolutionId) : undefined;
    return {
      ...emptyRow(!!item.resolutionId),
      id: item.id,
      title: item.title,
      note: item.note ?? '',
      resolutionId: item.resolutionId,
      locked: !!r && r.status !== 'DRAFT',
      text: r?.text ?? '',
      majority: r?.majority ?? null,
      assigneeIds: r?.assignees.map((p) => p.memberId) ?? [],
      implementDue: r?.implementDue ?? '',
    };
  });
}

/** What the server takes: a Beschluss row sends its motion (a voted one only its link), a plain row none. */
export function toInputs(rows: readonly AgendaRow[]): AgendaItemInput[] {
  return rows.map((row) => ({
    id: row.id,
    title: row.title.trim(),
    note: row.note.trim() || null,
    resolutionId: row.beschluss ? row.resolutionId : null,
    motion:
      row.beschluss && !row.locked
        ? { text: row.text.trim() || null, majority: row.majority, assigneeIds: [...row.assigneeIds], implementDue: row.implementDue || null }
        : null,
  }));
}

/** server: MeetingHandlers.checkedItems and Resolution — the first problem, or null. */
export function agendaError(rows: readonly AgendaRow[]): string | null {
  const max = settings.meetings.agenda;
  if (rows.length > max.maxItems) return `Höchstens ${max.maxItems} Punkte.`;
  if (rows.some((r) => !r.title.trim() || r.title.trim().length > max.titleMaxLength))
    return `Jeder Punkt braucht einen Titel (bis ${max.titleMaxLength} Zeichen).`;
  if (rows.some((r) => r.note.length > max.noteMaxLength)) return `Anmerkungen höchstens ${max.noteMaxLength} Zeichen.`;
  if (rows.some((r) => r.beschluss && r.text.length > max.motionTextMaxLength)) return `Antragstexte höchstens ${max.motionTextMaxLength} Zeichen.`;
  if (rows.some((r) => r.assigneeIds.length > max.maxAssignees)) return `Höchstens ${max.maxAssignees} Verantwortliche je Beschluss.`;
  return null;
}
