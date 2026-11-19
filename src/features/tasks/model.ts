import { TASK_STATUS_LABELS, type Hue } from '../../lib/types';

// Mirrors of the club-server tasks DTOs. API times are UTC instants.

export type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE';

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface TaskComment {
  id: string;
  authorId: string;
  text: string;
  createdAt: string;
}

export interface Task {
  id: string;
  /** null = club task. */
  teamId: string | null;
  appointmentId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueAt: string | null;
  createdBy: string;
  assignees: string[];
  checklist: ChecklistItem[];
  /** Only filled by GET /tasks/{id}; lists carry none. */
  comments: TaskComment[];
  createdAt: string;
  completedAt: string | null;
  /** Repeats every n weeks or n months (by date or nth weekday): finishing it creates the next one. Both null = once. */
  repeatWeeks: number | null;
  repeatMonths: number | null;
  repeatByWeekday: boolean;
  /** The record a system-created task is about, e.g. a member's change request. Only GET /tasks/{id} fills it. */
  source: TaskSource | null;
}

export interface TaskSource {
  /** MEETING_REMINDER: a deadline (invitation, circular vote, term end, yearly meetings, co-option, by-election) as a task. */
  kind: 'CHANGE_REQUEST' | 'RESOLUTION' | 'MEETING_REMINDER' | 'FINANCE_INVOICE';
  id: string;
}

export interface TaskList {
  items: Task[];
  /** More tasks exist than the list holds (server: 1000). */
  truncated: boolean;
}

export interface NewTask {
  teamId: string | null;
  appointmentId: string | null;
  title: string;
  description: string | null;
  dueAt: string | null;
  assignees: string[];
  checklist: string[];
  repeatWeeks: number | null;
  repeatMonths: number | null;
  repeatByWeekday: boolean;
}

/** Omitted fields stay unchanged; a given checklist replaces the old one (and resets its ticks). */
/** Absent fields stay unchanged; `clearDue` removes the due date (never together with `dueAt`). */
export type TaskPatch = Partial<Pick<NewTask, 'title' | 'description' | 'dueAt' | 'assignees' | 'checklist'>> & {
  clearDue?: boolean;
  repeatWeeks?: number;
  repeatMonths?: number;
  repeatByWeekday?: boolean;
  clearRepeat?: boolean;
};

/** "Wiederholen" choices; '' = once. */
export const REPEAT_OPTIONS: readonly { value: string; label: string }[] = [
  { value: '', label: 'Nicht wiederholen' },
  { value: '1', label: 'Jede Woche' },
  { value: '2', label: 'Alle 2 Wochen' },
  { value: '3', label: 'Alle 3 Wochen' },
  { value: '4', label: 'Alle 4 Wochen' },
  { value: 'm1', label: 'Jeden Monat am selben Tag' },
  { value: 'm1w', label: 'Jeden Monat am selben Wochentag (z. B. 2. Dienstag)' },
  { value: 'm3', label: 'Alle 3 Monate' },
  { value: 'm6', label: 'Alle 6 Monate' },
  { value: 'm12', label: 'Jedes Jahr' },
];

export type TaskRhythm = Pick<NewTask, 'repeatWeeks' | 'repeatMonths' | 'repeatByWeekday'>;

/** The select value of a rhythm: weeks as 'n', months as 'mn', by weekday 'mnw'; '' = once. */
export const rhythmCode = (r: TaskRhythm): string =>
  r.repeatWeeks ? String(r.repeatWeeks) : r.repeatMonths ? `m${r.repeatMonths}${r.repeatByWeekday ? 'w' : ''}` : '';

export const rhythmOf = (code: string): TaskRhythm =>
  code.startsWith('m')
    ? { repeatWeeks: null, repeatMonths: parseInt(code.slice(1)), repeatByWeekday: code.endsWith('w') }
    : { repeatWeeks: code ? Number(code) : null, repeatMonths: null, repeatByWeekday: false };

export const repeatLabel = (r: TaskRhythm): string | null => {
  const code = rhythmCode(r);
  if (!code) return null;
  const known = REPEAT_OPTIONS.find((o) => o.value === code);
  if (known) return known.label;
  return r.repeatWeeks ? `Alle ${r.repeatWeeks} Wochen` : `Alle ${r.repeatMonths} Monate${r.repeatByWeekday ? ' am selben Wochentag' : ''}`;
};

export interface TaskQuery {
  /** Only tasks assigned to the member or their minors. */
  mine: boolean;
  teamId: string | null;
  includeDone: boolean;
}

export const TASK_STATUSES: readonly { value: TaskStatus; label: string }[] = (Object.keys(TASK_STATUS_LABELS) as TaskStatus[]).map((value) => ({
  value,
  label: TASK_STATUS_LABELS[value],
}));

/** Not done and past its due time; the one rule behind tags, the "überfällig" filter and reminders. */
export const isOverdue = (task: Task, now: Date): boolean => task.status !== 'DONE' && task.dueAt !== null && Date.parse(task.dueAt) < now.getTime();

/** Not done and due within the next `hours`. */
export function isDueSoon(task: Task, hours: number, now: Date): boolean {
  if (task.status === 'DONE' || task.dueAt === null) return false;
  const due = Date.parse(task.dueAt);
  return due >= now.getTime() && due - now.getTime() <= hours * 3_600_000;
}

export const statusLabel = (status: TaskStatus): string => TASK_STATUSES.find((s) => s.value === status)?.label ?? status;

const STATUS_HUES: Readonly<Record<TaskStatus, Hue>> = { OPEN: 'gray', IN_PROGRESS: 'blue', DONE: 'green' };

export const statusHue = (status: TaskStatus): Hue => STATUS_HUES[status];

/** Sort order of statuses (open first). */
export const statusRank = (status: TaskStatus): number => TASK_STATUSES.findIndex((s) => s.value === status);

/**
 * server: TasksApi.TaskSettings — hours before the due time when assignees get the reminder; an overdue task is announced
 * again every `overdueRepeatDays` (0 = once) and escalated after `escalateAfterDays` (0 = never) to its creator, or the board
 * for tasks the app created.
 */
export interface TaskSettings {
  remindHours: number;
  overdueRepeatDays: number;
  escalateAfterDays: number;
}
