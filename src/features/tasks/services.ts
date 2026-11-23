import { settings } from '../../settings';
import { api, bus, permissions, session, store } from '../../lib/container';
import { Resource } from '../../lib/state/Resource.svelte';
import { CatalogStore } from '../../lib/state/CatalogStore.svelte';
import { TASK_CATALOG_CHANGED } from './events';
import { statusHue, statusLabel, type Task, type TaskLabel, type TaskLabelInput, type TaskStage, type TaskStageInput } from './model';
import type { Hue } from '../../lib/types';
import { DueReminders } from './DueReminders';
import { TaskPolicy } from './TaskPolicy';
import { TasksApi } from './TasksApi';

/** Task services, created once and shared by the task pages. */
export const tasksApi = new TasksApi(api);
/** The club's task statuses, the board's columns (server: tasks_stage). */
export const taskStages = new CatalogStore<string, TaskStage, TaskStageInput>(() => tasksApi.stages(), bus, TASK_CATALOG_CHANGED, [], {
  save: (key, input) => tasksApi.saveStage(key, input),
  delete: (key) => tasksApi.deleteStage(key),
});
/** The club's task labels (server: tasks_label). */
export const taskLabels = new CatalogStore<string, TaskLabel, TaskLabelInput>(() => tasksApi.labels(), bus, TASK_CATALOG_CHANGED, [], {
  save: (key, input) => tasksApi.saveLabel(key, input),
  delete: (key) => tasksApi.deleteLabel(key),
});
/** The task's club status as a tag; the phase's own while the catalog loads. */
export function stageTag(task: Pick<Task, 'stage' | 'status'>): { hue: Hue; label: string } {
  const stage = taskStages.get(task.stage);
  return stage ? { hue: stage.hue, label: taskStages.label(stage.key) } : { hue: statusHue(task.status), label: statusLabel(task.status) };
}
export const taskPolicy = new TaskPolicy(session, permissions);
/** The club's reminder lead (tasks_setting): "Bald fällig" and the due toasts use it too. Loaded at sign-in. */
export const taskSettings = new Resource(() => tasksApi.settings());
export const dueReminders = new DueReminders(
  tasksApi,
  store,
  bus,
  () => session.format,
  {
    dueSoonHours: () => taskSettings.value?.remindHours,
    checkEveryMs: settings.tasks.reminderCheckMs,
    maxToasts: settings.tasks.reminderMaxToasts,
  },
  (now) => session.clock.today(now),
);
