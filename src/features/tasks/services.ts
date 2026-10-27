import { settings } from '../../settings';
import { api, bus, permissions, session, store } from '../../lib/container';
import { DueReminders } from './DueReminders';
import { TaskPolicy } from './TaskPolicy';
import { TasksApi } from './TasksApi';

/** Task services, created once and shared by the task pages. */
export const tasksApi = new TasksApi(api);
export const taskPolicy = new TaskPolicy(session, permissions);
export const dueReminders = new DueReminders(
  tasksApi,
  store,
  bus,
  () => session.format,
  {
    dueSoonHours: settings.tasks.dueSoonHours,
    checkEveryMs: settings.tasks.reminderCheckMs,
    maxToasts: settings.tasks.reminderMaxToasts,
  },
  (now) => session.clock.today(now),
);
