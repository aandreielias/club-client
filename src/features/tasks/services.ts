import { settings } from '../../settings';
import { api, bus, permissions, session, store } from '../../lib/container';
import { Resource } from '../../lib/state/Resource.svelte';
import { DueReminders } from './DueReminders';
import { TaskPolicy } from './TaskPolicy';
import { TasksApi } from './TasksApi';

/** Task services, created once and shared by the task pages. */
export const tasksApi = new TasksApi(api);
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
