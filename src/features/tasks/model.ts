import type { Hue } from '../../lib/types';

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

export const repeatLabel = (weeks: number | null): string | null =>
  weeks === null ? null : weeks === 1 ? 'Jede Woche' : `Alle ${weeks} Wochen`;

export interface TaskQuery {
  /** Only tasks assigned to the member or their minors. */
  mine: boolean;
  teamId: string | null;
  includeDone: boolean;
  /** Due range [dueFrom, dueTo) as instants; with a range, undated tasks are left out. */
  dueFrom?: string;
  dueTo?: string;
}

export const TASK_STATUSES: readonly { value: TaskStatus; label: string }[] = [
  { value: 'OPEN', label: 'Offen' },
  { value: 'IN_PROGRESS', label: 'In Arbeit' },
  { value: 'DONE', label: 'Erledigt' },
];

export const statusLabel = (status: TaskStatus): string => TASK_STATUSES.find((s) => s.value === status)?.label ?? status;

const STATUS_HUES: Readonly<Record<TaskStatus, Hue>> = { OPEN: 'gray', IN_PROGRESS: 'blue', DONE: 'green' };

export const statusHue = (status: TaskStatus): Hue => STATUS_HUES[status];

/** Sort order of statuses (open first). */
export const statusRank = (status: TaskStatus): number => TASK_STATUSES.findIndex((s) => s.value === status);
