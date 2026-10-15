<script lang="ts">
  import { settings } from '../../settings';
  import Button from '../../ui/Button.svelte';
  import type { TaskForm } from './TaskForm.svelte';

  let { form, error }: { form: TaskForm; error: string | null } = $props();

  const limits = settings.tasks;
</script>

<fieldset class="stack">
  <legend>Checkliste <span class="muted">(optional)</span></legend>
  {#if form.checklist.length}
    <ol class="lines">
      {#each form.checklist as line, index (line.key)}
        <li class="row">
          <input bind:value={line.text} maxlength={limits.checklistItemMaxLength} aria-label="Punkt {index + 1}" />
          <Button variant="ghost" onclick={() => form.removeLine(line.key)} tooltip="Checklistenpunkt entfernen">Entfernen</Button>
        </li>
      {/each}
    </ol>
  {/if}
  {#if form.resetsTicks}
    <p class="warning">Beim Speichern einer geänderten Checkliste werden alle Haken zurückgesetzt.</p>
  {/if}
  {#if error}<span class="error" role="alert">{error}</span>{/if}
  <div>
    <Button onclick={() => form.addLine()} disabled={form.checklist.length >= limits.maxChecklistItems}>Punkt hinzufügen</Button>
  </div>
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
  .lines {
    display: grid;
    gap: var(--space-xs);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .lines input {
    flex: 1;
    min-width: 0;
    width: auto;
  }
  .lines li {
    flex-wrap: nowrap;
  }
  .warning {
    margin: 0;
    color: var(--color-warning);
    font-size: var(--font-size-small);
  }
  .error {
    color: var(--color-danger);
    font-size: var(--font-size-small);
  }
</style>
