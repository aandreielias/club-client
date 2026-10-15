// Live event types of the tasks module (server: TasksApi.TaskChanged / TaskDueSoon).

export const TASK_CHANGED = 'tasks.task-changed';
export const TASK_DUE_SOON = 'tasks.task-due-soon';

export interface TaskChanged {
  taskId: string;
  teamId: string | null;
  change: 'CREATED' | 'UPDATED' | 'STATUS' | 'COMMENTED' | 'DELETED';
}
