<script lang="ts">
  import { bus, windows } from '../../lib/container';
  import { WINDOW_OPEN } from '../../channels';
  import type { MenuEntry } from '../../lib/overlay/ContextMenuService.svelte';
  import DataTable from '../../ui/DataTable.svelte';
  import type { EmptyAction } from '../../ui/Empty.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { statusHue, statusLabel, type Task } from './model';
  import TaskDue from './TaskDue.svelte';
  import type { TaskListModel } from './TaskListModel.svelte';

  /** Tasks as rows (task list page, start page): status tag, due date, opens in the window. */
  let {
    list,
    menu,
    emptyText,
    emptyAction,
    toolbar = true,
    limit,
  }: { list: TaskListModel; menu?: (task: Task) => MenuEntry[]; emptyText: string; emptyAction?: EmptyAction | null; toolbar?: boolean; limit?: number } = $props();
</script>

<DataTable
  model={list}
  {toolbar}
  {limit}
  rowKey={(t) => t.id}
  record={(t) => ({ kind: 'task', id: t.id, title: t.title })}
  onopen={(t) => bus.publish(WINDOW_OPEN, { kind: 'task', id: t.id })}
  {menu}
  selected={windows.current?.kind === 'task' ? windows.current.id : null}
  {emptyText}
  {emptyAction}
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

<style>
  .done {
    color: var(--color-text-muted);
    text-decoration: line-through;
  }
</style>
