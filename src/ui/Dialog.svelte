<script lang="ts">
  import type { Snippet } from 'svelte';

  /** Small modal prompt (confirm, short forms). Details open in the WindowHost instead. */
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
  <h2 class="title">{title}</h2>
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
    width: min(var(--layout-readable-width), calc(100vw - 2 * var(--space-lg)));
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
  /* Also inside a window, whose section headings are small and ruled. */
  dialog > h2.title {
    margin: 0 0 var(--space-md);
    padding: 0;
    border: 0;
    color: var(--color-text);
    font-size: var(--font-size-h2);
    letter-spacing: -0.015em;
  }
</style>
