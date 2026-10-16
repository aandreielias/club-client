// Live event types of the tasks module (server: TasksApi.TaskChanged / TaskDueSoon).

import { liveEvent } from '../../lib/live/LiveUpdates.svelte';

export const TASK_CHANGED = liveEvent<TaskChanged>('tasks.task-changed');
export const TASK_DUE_SOON = liveEvent<unknown>('tasks.task-due-soon');

export interface TaskChanged {
  taskId: string;
  teamId: string | null;
  change: 'CREATED' | 'UPDATED' | 'STATUS' | 'COMMENTED' | 'DELETED';
}
