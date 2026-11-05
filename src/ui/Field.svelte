<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * Label + control (children) + hint or error. The label wraps only the caption and the control,
   * so the control's accessible name is the caption alone (hints stay out of it).
   * `group` is for a control that names itself (a fieldset such as ChoiceGroup): the caption is shown
   * but no <label> wraps it, since a label must not hold a fieldset.
   */
  let {
    label,
    hint,
    error,
    group = false,
    children,
  }: { label: string; hint?: string; error?: string | null; group?: boolean; children: Snippet } = $props();
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
  {#if error}
    <span class="message error" role="alert">{error}</span>
  {:else if hint}
    <span class="message muted">{hint}</span>
  {/if}
</div>

<style>
  .field,
  .control,
  label {
    display: grid;
    align-content: start;
    gap: var(--space-xs);
    min-width: 0;
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
