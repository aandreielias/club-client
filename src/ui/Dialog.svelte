<script lang="ts">
  import type { Snippet } from 'svelte';

  /** Small modal prompt (PIN, confirm, short forms). Details open in the WindowHost instead. */
  let {
    open,
    title,
    onclose,
    wide = false,
    children,
  }: {
    open: boolean;
    title: string;
    onclose: () => void;
    /** Room for a list (e.g. choosing teams). */ wide?: boolean;
    children: Snippet;
  } = $props();

  let element: HTMLDialogElement;

  $effect(() => {
    if (open && !element.open) element.showModal();
    else if (!open && element.open) element.close();
  });
</script>

<dialog bind:this={element} {onclose} aria-label={title} class:wide>
  <h3>{title}</h3>
  {@render children()}
</dialog>

<style>
  dialog {
    width: min(var(--layout-narrow-width), calc(100vw - 2 * var(--space-lg)));
    padding: var(--space-xl);
    border: 0;
    border-radius: var(--radius-xl);
    background: var(--color-elevated);
    color: var(--color-text);
    box-shadow: var(--color-shadow-window);
  }
  dialog.wide {
    width: min(720px, calc(100vw - 2 * var(--space-lg)));
  }
  dialog[open] {
    animation: dialog-in var(--motion-base) var(--motion-easing);
  }
  dialog::backdrop {
    background: var(--color-backdrop);
    backdrop-filter: blur(2px);
  }
  dialog[open]::backdrop {
    animation: backdrop-in var(--motion-base) ease-out;
  }
  @keyframes dialog-in {
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.97);
    }
  }
  @keyframes backdrop-in {
    from {
      opacity: 0;
    }
  }
  h3 {
    margin-bottom: var(--space-md);
    font-size: var(--font-size-h2);
  }
</style>
