import { api, permissions, session } from '../../lib/container';
import { TaskPolicy } from './TaskPolicy';
import { TasksApi } from './TasksApi';

/** Task services, created once and shared by the task pages. */
export const tasksApi = new TasksApi(api);
export const taskPolicy = new TaskPolicy(session, permissions);
