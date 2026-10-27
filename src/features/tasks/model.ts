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
  /** Repeats every n weeks: finishing it creates the next one. null = once. */
  repeatWeeks: number | null;
  /** The record a system-created task is about, e.g. a member's change request. Only GET /tasks/{id} fills it. */
  source: TaskSource | null;
}

export interface TaskSource {
  /** MEETING_REMINDER: a deadline (invitation, circular vote, term end, yearly meetings, co-option, by-election) as a task. */
  kind: 'CHANGE_REQUEST' | 'MEETING_FOLLOW_UP' | 'MEETING_REMINDER';
  id: string;
}

export interface TaskList {
  items: Task[];
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
}

/** Omitted fields stay unchanged; a given checklist replaces the old one (and resets its ticks). */
/** Absent fields stay unchanged; `clearDue` removes the due date (never together with `dueAt`). */
export type TaskPatch = Partial<Pick<NewTask, 'title' | 'description' | 'dueAt' | 'assignees' | 'checklist'>> & {
  clearDue?: boolean;
  repeatWeeks?: number;
  clearRepeat?: boolean;
};

/** "Wiederholen" choices; '' = once. */
export const REPEAT_OPTIONS: readonly { value: string; label: string }[] = [
  { value: '', label: 'Nicht wiederholen' },
  { value: '1', label: 'Jede Woche' },
  { value: '2', label: 'Alle 2 Wochen' },
  { value: '3', label: 'Alle 3 Wochen' },
  { value: '4', label: 'Alle 4 Wochen' },
];

export const repeatLabel = (weeks: number | null): string | null => (weeks === null ? null : weeks === 1 ? 'Jede Woche' : `Alle ${weeks} Wochen`);

export interface TaskQuery {
  /** Only tasks assigned to the member or their minors. */
  mine: boolean;
  teamId: string | null;
  includeDone: boolean;
  /** Due range [dueFrom, dueTo) as instants; with a range, undated tasks are left out. */
  dueFrom?: string;
  dueTo?: string;
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
