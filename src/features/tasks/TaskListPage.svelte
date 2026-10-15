<script lang="ts">
  import { commands, directory, errors, live, permissions, router, store, toasts, windows } from '../../lib/container';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import { onLive } from '../../lib/live/onLive.svelte';
  import Button from '../../ui/Button.svelte';
  import type { MenuEntry } from '../../lib/overlay/ContextMenuService.svelte';
  import { windowMenu } from '../../lib/window/windowMenu';
  import DataTable from '../../ui/DataTable.svelte';
  import Page from '../../ui/Page.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { TASK_CHANGED } from './events';
  import { statusHue, statusLabel, type Task } from './model';
  import TaskDue from './TaskDue.svelte';
  import { TaskListModel } from './TaskListModel.svelte';
  import { taskPolicy, tasksApi } from './services';

  const list = new TaskListModel(tasksApi, taskPolicy, directory, store);
  void list.load();
  directory.loadRosters();
  if (permissions.isManager) directory.loadTeams().catch(() => {});
  onLive(live, TASK_CHANGED, () => void list.load());
  /** Window entries plus done/reopen for members who work on the task. */
  function taskMenu(task: Task): MenuEntry[] {
    const done = task.status === 'DONE';
    return [
      ...windowMenu(windows, router, 'task', task.id),
      { separator: true },
      {
        label: done ? 'Wieder öffnen' : 'Als erledigt markieren',
        disabled: !taskPolicy.canWork(task),
        run: async () => {
          try {
            await tasksApi.setStatus(task.id, done ? 'OPEN' : 'DONE');
            toasts.show(done ? 'Aufgabe wieder geöffnet.' : 'Aufgabe erledigt.');
            void list.load();
          } catch (error) {
            toasts.error(errors.text(error));
          }
        },
      },
    ];
  }

  useCommands(commands, { 'page.new': { run: () => windows.open('task-new', list.filters.team || '-'), when: () => taskPolicy.canCreate() } });
</script>

<Page title="Aufgaben">
  {#snippet actions()}
    {#if taskPolicy.canCreate()}
      <Button variant="primary" onclick={() => windows.open('task-new', list.filters.team || '-')}>Neue Aufgabe</Button>
    {/if}
  {/snippet}

  <DataTable
    model={list}
    rowKey={(t) => t.id}
    onopen={(t) => windows.open('task', t.id)}
    menu={taskMenu}
    selected={windows.current?.kind === 'task' ? windows.current.id : null}
    emptyText={list.filters.mine ? 'Dir ist keine offene Aufgabe zugewiesen.' : 'Keine Aufgaben.'}
  >
    {#snippet cell(task, column)}
      {#if column.key === 'title'}
        <span class:done={task.status === 'DONE'}>{task.title}</span>
      {:else if column.key === 'status'}
        <Tag tone={statusHue(task.status)}>{statusLabel(task.status)}</Tag>
      {:else if column.key === 'due'}
        <TaskDue {task} />
      {:else}
        {list.display(task, column)}
      {/if}
    {/snippet}
  </DataTable>
</Page>

<style>
  .done {
    color: var(--color-text-muted);
    text-decoration: line-through;
  }
</style>
