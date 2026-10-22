import TasksHome from './TasksHome.svelte';
import { PRIVILEGED } from '../../lib/types';
import type { Feature } from '../Feature';
import { TASK_MESSAGES } from './messages';
import { dueReminders } from './services';
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
  calendar: {
    TASK: (item) => ({ hue: item.inactive ? 'green' : 'orange', label: 'Fällig' }),
    FOLLOW_UP: (item) => ({ hue: item.inactive ? 'green' : 'brown', label: 'Fällig (aus Sitzung)' }),
  },
  messages: TASK_MESSAGES,
  start: () => dueReminders.start(),
  home: { id: 'tasks', label: 'Meine Aufgaben', component: TasksHome },
  links: [{ server: '/tasks/:id', to: ({ id }) => ({ window: { kind: 'task', id } }) }],
};
