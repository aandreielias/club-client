// Live event types of the tasks module (server: TasksApi.TaskChanged).

import { liveEvent } from '../../lib/live/LiveUpdates.svelte';

export const TASK_CHANGED = liveEvent<TaskChanged>('tasks.task-changed');

export interface TaskChanged {
  taskId: string;
  teamId: string | null;
  change: 'CREATED' | 'UPDATED' | 'STATUS' | 'COMMENTED' | 'DELETED';
}
