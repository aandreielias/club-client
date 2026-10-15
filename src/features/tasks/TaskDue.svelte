<script lang="ts">
  import { settings } from '../../settings';
  import { session } from '../../lib/container';
  import Tag from '../../ui/Tag.svelte';
  import type { Task } from './model';
  import { taskPolicy } from './services';

  /** Due date with an overdue / due-soon marker. */
  let { task }: { task: Task } = $props();

  const overdue = $derived(taskPolicy.isOverdue(task));
  const soon = $derived(taskPolicy.isDueSoon(task, settings.tasks.dueSoonHours));
</script>

{#if task.dueAt}
  <span class="due">
    {session.format.dateTime(task.dueAt)}
    {#if overdue}<Tag tone="danger">Überfällig</Tag>{:else if soon}<Tag tone="warning">Bald fällig</Tag>{/if}
  </span>
{:else}
  <span class="muted">Ohne Termin</span>
{/if}

<style>
  .due {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-xs);
  }
</style>
