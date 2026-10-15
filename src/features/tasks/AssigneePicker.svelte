<script lang="ts">
  import { untrack } from 'svelte';
  import { directory } from '../../lib/container';
  import { Resource } from '../../lib/state/Resource.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Empty from '../../ui/Empty.svelte';
  import type { TaskForm } from './TaskForm.svelte';

  /**
   * Checkbox list of possible assignees: the team's roster, or every member for club tasks
   * (admin/board only; the server may ask for the PIN first).
   */
  let { form, error }: { form: TaskForm; error: string | null } = $props();

  const options = new Resource(() => directory.candidates(form.teamOrNull));
  let search = $state('');

  $effect(() => {
    form.teamOrNull; // reload when the team changes
    untrack(() => options.load().then(() => form.retainAssignees((options.value ?? []).map((c) => c.memberId))));
  });

  const visible = $derived(
    (options.value ?? []).filter((c) => c.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())),
  );
</script>

<fieldset class="stack">
  <legend>Zugewiesen <span class="muted">({form.assignees.length})</span></legend>
  <AsyncView resource={options}>
    {#snippet children(candidates)}
      {#if candidates.length > 8}
        <input type="search" bind:value={search} placeholder="Name suchen" aria-label="Name suchen" />
      {/if}
      {#if visible.length}
        <ul class="options">
          {#each visible as candidate (candidate.memberId)}
            <li>
              <label>
                <input type="checkbox" checked={form.isAssigned(candidate.memberId)} onchange={() => form.toggleAssignee(candidate.memberId)} />
                {candidate.name}
              </label>
            </li>
          {/each}
        </ul>
      {:else}
        <Empty text="Keine passenden Mitglieder." />
      {/if}
    {/snippet}
  </AsyncView>
  {#if error}<span class="error" role="alert">{error}</span>{/if}
</fieldset>

<style>
  fieldset {
    margin: 0;
    padding: 0;
    border: 0;
  }
  legend {
    margin-bottom: var(--space-xs);
    font-size: var(--font-size-small);
    font-weight: var(--font-weight-medium);
  }
  .options {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
    gap: var(--space-xs) var(--space-md);
    max-height: 16rem;
    overflow-y: auto;
  }
  label {
    display: flex;
    align-items: baseline;
    gap: var(--space-sm);
  }
  .error {
    color: var(--color-danger);
    font-size: var(--font-size-small);
  }
</style>
