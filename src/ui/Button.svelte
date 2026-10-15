<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  type Variant = 'default' | 'primary' | 'ghost' | 'danger';
  type Size = 'md' | 'sm';

  let {
    variant = 'default',
    size = 'md',
    busy = false,
    pressed,
    children,
    ...rest
  }: HTMLButtonAttributes & { variant?: Variant; size?: Size; busy?: boolean; pressed?: boolean; children: Snippet } = $props();
</script>

<button type="button" {...rest} class="button {variant} {size}" class:pressed disabled={busy || rest.disabled} aria-busy={busy}
  aria-pressed={pressed}>
  {@render children()}
</button>

<style>
  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-xs);
    min-height: var(--control-height);
    padding: 0 var(--control-padding-x);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-background);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
    line-height: 1.3;
    white-space: nowrap;
    cursor: pointer;
    transition: background var(--motion-fast);
  }
  /* Same height and text size as every control; only tighter padding. */
  .sm {
    padding: 0 var(--space-sm);
  }
  .button:hover:not(:disabled) {
    background: var(--color-hover);
  }
  .button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .primary {
    border-color: transparent;
    background: var(--color-accent);
    color: var(--color-on-accent);
  }
  .primary:hover:not(:disabled) {
    background: var(--color-accent);
    filter: brightness(0.94);
  }
  .ghost {
    border-color: transparent;
    background: transparent;
    color: var(--color-text-muted);
  }
  .ghost:hover:not(:disabled) {
    color: var(--color-text);
  }
  .danger {
    color: var(--color-danger);
  }
  .danger:hover:not(:disabled) {
    background: var(--color-tag-red-bg);
  }
  .pressed {
    background: var(--color-selected);
    color: var(--color-text);
  }
</style>
