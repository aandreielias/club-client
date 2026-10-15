<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * Label + control (children) + hint or error. The label wraps only the caption and the control,
   * so the control's accessible name is the caption alone (hints stay out of it).
   */
  let { label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: Snippet } = $props();
</script>

<div class="field">
  <label>
    <span class="label">{label}</span>
    {@render children()}
  </label>
  {#if error}
    <span class="message error" role="alert">{error}</span>
  {:else if hint}
    <span class="message muted">{hint}</span>
  {/if}
</div>

<style>
  .field,
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
