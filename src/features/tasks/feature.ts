import { PRIVILEGED } from '../../lib/types';
import type { Feature } from '../Feature';
import { TASK_MESSAGES } from './messages';
import { tasksApi } from './services';
import { TaskCalendarSource } from './TaskCalendarSource';
import TaskCreateView from './TaskCreateView.svelte';
import TaskListPage from './TaskListPage.svelte';
import TaskPage from './TaskPage.svelte';
import TaskView from './TaskView.svelte';

export const tasksFeature: Feature = {
  id: 'tasks',
  routes: [
    { path: '/tasks', component: TaskListPage, nav: 'Aufgaben', icon: 'tasks' },
    { path: '/tasks/:id', component: TaskPage },
  ],
  windows: {
    task: { component: TaskView, page: (id) => `/tasks/${encodeURIComponent(id)}` },
    'task-new': { component: TaskCreateView, roles: PRIVILEGED },
  },
  calendar: new TaskCalendarSource(tasksApi),
  messages: TASK_MESSAGES,
  links: [{ server: '/tasks/:id', to: ({ id }) => ({ window: { kind: 'task', id } }) }],
};
