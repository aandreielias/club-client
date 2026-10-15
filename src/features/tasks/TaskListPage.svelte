<script lang="ts">
  import { commands, directory, live, permissions, store, windows } from '../../lib/container';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import { onLive } from '../../lib/live/onLive.svelte';
  import Button from '../../ui/Button.svelte';
  import DataTable from '../../ui/DataTable.svelte';
  import Page from '../../ui/Page.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { TASK_CHANGED } from './events';
  import { statusHue, statusLabel } from './model';
  import TaskDue from './TaskDue.svelte';
  import { TaskListModel } from './TaskListModel.svelte';
  import { taskPolicy, tasksApi } from './services';

  const list = new TaskListModel(tasksApi, taskPolicy, directory, store);
  void list.load();
  directory.loadRosters();
  if (permissions.isManager) directory.loadTeams().catch(() => {});
  onLive(live, TASK_CHANGED, () => void list.load());
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
