<script lang="ts">
  import type { Snippet } from 'svelte';
  import InfoTip from './InfoTip.svelte';

  /**
   * Label + control (children) + error or `note` (visible status, e.g. "Noch nicht eingetragen"); the hint is an ⓘ after the caption. The label wraps only the caption and the control,
   * so the control's accessible name is the caption alone (the ⓘ stays outside it, placed by the grid).
   * `group` is for a control that names itself (a fieldset such as ChoiceGroup): the caption is shown
   * but no <label> wraps it, since a label must not hold a fieldset.
   */
  let {
    label,
    hint,
    note,
    error,
    group = false,
    children,
  }: { label: string; hint?: string; note?: string; error?: string | null; group?: boolean; children: Snippet } = $props();
</script>

<div class="field">
  {#if group}
    <div class="control">
      <span class="label" aria-hidden="true">{label}</span>
      {@render children()}
    </div>
  {:else}
    <label>
      <span class="label">{label}</span>
      {@render children()}
    </label>
  {/if}
  {#if hint}<span class="tip"><InfoTip text={hint} /></span>{/if}
  {#if error}
    <span class="message error" role="alert">{error}</span>
  {:else if note}
    <span class="message muted">{note}</span>
  {/if}
</div>

<style>
  .field {
    display: grid;
    grid-template-columns: auto 1fr;
    align-content: start;
    gap: var(--space-xs);
    min-width: 0;
  }
  /* Caption and ⓘ share the first row; the control and the message take the full width below. */
  .control,
  label {
    display: contents;
  }
  .field > * > :global(*),
  .message {
    grid-column: 1 / -1;
    min-width: 0;
  }
  .field > * > .label {
    grid-row: 1;
    grid-column: 1;
  }
  .tip {
    display: flex;
    grid-row: 1;
    grid-column: 2;
    margin-block: -2px;
  }
  .label {
    color: var(--color-text-muted);
    font-size: var(--font-size-small);
    font-weight: var(--font-weight-medium);
  }
  .message {
    font-size: var(--font-size-small);
  }
  .error {
    color: var(--color-danger);
  }
</style>
