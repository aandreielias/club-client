<script lang="ts">
  import type { TaskDetailModel } from './TaskDetailModel.svelte';
  import type { Task } from './model';

  let { task, detail, editable }: { task: Task; detail: TaskDetailModel; editable: boolean } = $props();
</script>

<ul class="checklist">
  {#each task.checklist as item (item.id)}
    <li>
      <label class:done={item.done}>
        <input type="checkbox" checked={item.done} disabled={!editable || detail.pendingItem !== null} onchange={() => detail.toggle(item)} />
        {item.text}
      </label>
    </li>
  {/each}
</ul>

<style>
  .checklist {
    display: grid;
    gap: var(--space-xs);
  }
  label {
    display: flex;
    align-items: baseline;
    gap: var(--space-sm);
  }
  .done {
    color: var(--color-text-muted);
    text-decoration: line-through;
  }
</style>
