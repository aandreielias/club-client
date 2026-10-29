<script lang="ts">
  import Button from './Button.svelte';

  /** Short text lines to add, edit and remove (e.g. checklist items of a task template); empty lines are dropped by whoever saves. */
  let {
    lines = $bindable(),
    label,
    max,
    maxLength,
    addLabel = 'Punkt hinzufügen',
  }: { lines: string[]; label: string; max: number; maxLength: number; addLabel?: string } = $props();

  let inputs: HTMLInputElement[] = $state([]);

  function add() {
    lines = [...lines, ''];
    queueMicrotask(() => inputs[lines.length - 1]?.focus());
  }

  /** Enter adds the next line, Backspace on an empty one removes it. */
  function key(event: KeyboardEvent, index: number) {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (lines.length < max) add();
    } else if (event.key === 'Backspace' && !lines[index] && lines.length) {
      event.preventDefault();
      lines = lines.filter((_, i) => i !== index);
      queueMicrotask(() => inputs[Math.max(0, index - 1)]?.focus());
    }
  }
</script>

<fieldset class="stack">
  <legend>{label}</legend>
  {#if lines.length}
    <ol class="lines">
      {#each lines as _, index (index)}
        <li class="row">
          <input
            bind:this={inputs[index]}
            bind:value={lines[index]}
            maxlength={maxLength}
            aria-label="{label}: Punkt {index + 1}"
            onkeydown={(e) => key(e, index)}
          />
          <Button size="sm" variant="ghost" icon="delete" tooltip="Punkt entfernen" onclick={() => (lines = lines.filter((_, i) => i !== index))} />
        </li>
      {/each}
    </ol>
  {/if}
  <div><Button size="sm" icon="add" onclick={add} disabled={lines.length >= max}>{addLabel}</Button></div>
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
  .lines li {
    flex-wrap: nowrap;
  }
  .lines input {
    flex: 1;
    min-width: 0;
    width: auto;
  }
</style>
