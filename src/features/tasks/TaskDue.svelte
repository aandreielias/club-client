<script lang="ts">
  import { minuteClock } from '../../lib/time/minuteClock.svelte';
  import { session } from '../../lib/container';
  import Tag from '../../ui/Tag.svelte';
  import { isDueSoon, isOverdue, type Task } from './model';
  import { taskSettings } from './services';

  /** Due date with an overdue / due-soon marker. */
  let { task }: { task: Task } = $props();

  const overdue = $derived(isOverdue(task, minuteClock.now));
  const soon = $derived(isDueSoon(task, taskSettings.value?.remindHours ?? 0, minuteClock.now));
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
