import TasksHome from './TasksHome.svelte';
import { permissions } from '../../lib/container';
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
    // Admin/board, and coaches of a team (by team role, server: requireMayManage).
    'task-new': { component: TaskCreateView, canOpen: () => permissions.canManageAnything() },
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
