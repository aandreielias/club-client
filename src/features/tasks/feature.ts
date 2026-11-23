import TasksHome from './TasksHome.svelte';
import { bus, permissions } from '../../lib/container';
import { LIVE_RESYNC } from '../../lib/live/LiveUpdates.svelte';
import { TASK_SETTINGS_CHANGED } from './events';
import { detailRoute, type Feature } from '../Feature';
import { TASK_MESSAGES } from './messages';
import { dueReminders, taskLabels, taskSettings, taskStages } from './services';
import TaskCreateView from './TaskCreateView.svelte';
import TaskListPage from './TaskListPage.svelte';
import TaskView from './TaskView.svelte';
import { taskActions, taskLabelActions, taskStageActions } from './actions';
import TaskStageView from './TaskStageView.svelte';
import TaskLabelView from './TaskLabelView.svelte';
import { ADMIN_BOARD } from '../../lib/types';

export const tasksFeature: Feature = {
  id: 'tasks',
  routes: [
    { path: '/tasks', component: TaskListPage, nav: 'Aufgaben', icon: 'tasks' },
    detailRoute('/tasks/:id', TaskView, { href: '/tasks', label: 'Aufgaben' }),
  ],
  windows: {
    task: { label: 'Aufgabe', component: TaskView, page: (id) => `/tasks/${encodeURIComponent(id)}` },
    // Admin/board, and coaches of a team (by team role, server: requireMayManage).
    'task-new': { label: 'Neue Aufgabe', component: TaskCreateView, canOpen: () => permissions.canManageAnything() },
    'task-stage': { label: 'Aufgaben-Status', component: TaskStageView, roles: ADMIN_BOARD },
    'task-stage-new': { label: 'Neuer Aufgaben-Status', component: TaskStageView, roles: ADMIN_BOARD },
    'task-label': { label: 'Aufgaben-Label', component: TaskLabelView, roles: ADMIN_BOARD },
    'task-label-new': { label: 'Neues Aufgaben-Label', component: TaskLabelView, roles: ADMIN_BOARD },
  },
  actions: { task: taskActions, 'task-stage': taskStageActions, 'task-label': taskLabelActions },
  calendar: {
    TASK: (item) => ({ hue: item.inactive ? 'green' : 'orange', label: 'Fällig' }),
    FOLLOW_UP: (item) => ({ hue: item.inactive ? 'green' : 'brown', label: 'Fällig (aus Sitzung)' }),
  },
  messages: TASK_MESSAGES,
  start: (guest) => {
    if (guest) return undefined;
    let stop: (() => void) | undefined;
    let ended = false;
    void taskSettings.load().then(() => {
      if (!ended) stop = dueReminders.start();
    });
    const reload = () => void taskSettings.load();
    const subscriptions = [bus.subscribe(TASK_SETTINGS_CHANGED, reload), bus.subscribe(LIVE_RESYNC, reload)];
    const catalogs = [taskStages.start(), taskLabels.start()];
    return () => {
      ended = true;
      stop?.();
      catalogs.forEach((s) => s());
      subscriptions.forEach((s) => s.unsubscribe());
    };
  },
  home: { id: 'tasks', label: 'Meine Aufgaben', component: TasksHome },
  links: [{ server: '/tasks/:id', to: ({ id }) => ({ window: { kind: 'task', id } }) }],
};
