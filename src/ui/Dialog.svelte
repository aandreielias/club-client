<script lang="ts">
  import type { Snippet } from 'svelte';

  /** Small modal prompt (PIN, confirm, short forms). Details open in the WindowHost instead. */
  let { open, title, onclose, children }: { open: boolean; title: string; onclose: () => void; children: Snippet } = $props();

  let element: HTMLDialogElement;

  $effect(() => {
    if (open && !element.open) element.showModal();
    else if (!open && element.open) element.close();
  });
</script>

<dialog bind:this={element} {onclose} aria-label={title}>
  <h3>{title}</h3>
  {@render children()}
</dialog>

<style>
  dialog {
    width: min(var(--layout-narrow-width), calc(100vw - 2 * var(--space-lg)));
    padding: var(--space-xl);
    border: 0;
    border-radius: var(--radius-lg);
    background: var(--color-background);
    color: var(--color-text);
    box-shadow: var(--color-shadow-window);
  }
  dialog::backdrop {
    background: var(--color-backdrop);
  }
  h3 {
    margin-bottom: var(--space-md);
  }
</style>
