<script lang="ts">
  import { background } from '../../lib/state/background';
  import { bus, commands, directory, permissions, router, store, windows } from '../../lib/container';
  import { APP_ERROR, TOAST, WINDOW_OPEN } from '../../channels';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import Button from '../../ui/Button.svelte';
  import type { MenuEntry } from '../../lib/overlay/ContextMenuService.svelte';
  import { windowMenu } from '../../lib/window/windowMenu';
  import TaskTable from './TaskTable.svelte';
  import Page from '../../ui/Page.svelte';
  import { TASK_CHANGED } from './events';
  import type { Task } from './model';
  import { TaskListModel } from './TaskListModel.svelte';
  import { taskPolicy, tasksApi } from './services';

  const list = new TaskListModel(tasksApi, taskPolicy, directory, store);
  void list.load();
  directory.loadRosters();
  if (permissions.isManager) background(directory.loadTeams());
  useBus(bus, TASK_CHANGED, () => void list.load());
  /** Window entries plus done/reopen for members who work on the task. */
  function taskMenu(task: Task): MenuEntry[] {
    const done = task.status === 'DONE';
    return [
      ...windowMenu(bus, windows, router, 'task', task.id),
      { separator: true },
      {
        label: done ? 'Wieder öffnen' : 'Als erledigt markieren',
        disabled: !taskPolicy.canWork(task),
        run: async () => {
          try {
            await tasksApi.setStatus(task.id, done ? 'OPEN' : 'DONE');
            bus.publish(TOAST, { text: done ? 'Aufgabe wieder geöffnet.' : 'Aufgabe erledigt.' });
            void list.load();
          } catch (error) {
            bus.publish(APP_ERROR, error);
          }
        },
      },
    ];
  }

  useCommands(commands, { 'page.new': { run: () => bus.publish(WINDOW_OPEN, { kind: 'task-new', id: list.filters.team || '-' }), when: () => taskPolicy.canCreate() } });
</script>

<Page title="Aufgaben">
  {#snippet actions()}
    {#if taskPolicy.canCreate()}
      <Button variant="primary" icon="add" onclick={() => bus.publish(WINDOW_OPEN, { kind: 'task-new', id: list.filters.team || '-' })}>Neue Aufgabe</Button>
    {/if}
  {/snippet}

  <TaskTable {list} menu={taskMenu} emptyText={list.filters.mine ? 'Dir ist keine offene Aufgabe zugewiesen.' : 'Keine Aufgaben.'}
    emptyAction={taskPolicy.canCreate() ? { label: 'Neue Aufgabe', icon: 'add', run: () => bus.publish(WINDOW_OPEN, { kind: 'task-new', id: list.filters.team || '-' }) } : null} />
</Page>
