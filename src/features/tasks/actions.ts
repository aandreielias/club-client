import { attempt, inWindow, type RecordActionProvider } from '../../lib/actions/RecordActions';
import { bus, pendingDeletes } from '../../lib/container';
import type { Task } from './model';
import { taskPolicy as policy, tasksApi } from './services';

/** What can be done with a task: context menus, its window and the command palette. */
export const taskActions: RecordActionProvider<Task> = {
  load: (id) => tasksApi.get(id),
  actions: (task) => {
    const done = task.status === 'DONE';
    return [
      ...(policy.canWork(task)
        ? [
            {
              command: 'task.done' as const,
              label: done ? 'Wieder öffnen' : 'Als erledigt markieren',
              icon: 'check' as const,
              run: () =>
                attempt(bus, () => tasksApi.setStatus(task.id, done ? 'OPEN' : 'DONE'), done ? 'Aufgabe wieder geöffnet.' : 'Aufgabe erledigt.'),
            },
          ]
        : []),
      ...(policy.canManage(task)
        ? [
            inWindow(bus, 'task', task.id, 'record.edit', { icon: 'edit', group: 'edit' }),
            {
              command: 'record.delete' as const,
              icon: 'delete' as const,
              danger: true,
              group: 'edit',
              leaves: true,
              run: () =>
                pendingDeletes.schedule({ ids: [task.id], text: `Aufgabe „${task.title}“ gelöscht.`, commit: () => tasksApi.delete(task.id) }),
            },
          ]
        : []),
    ];
  },
};
