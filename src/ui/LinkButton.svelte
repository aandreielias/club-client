<script lang="ts">
  import type { Snippet } from 'svelte';

  /** Navigation styled like a Button (it is a link, so it stays a link for assistive tech). */
  let { href, variant = 'default', children }: { href: string; variant?: 'default' | 'primary'; children: Snippet } = $props();
</script>

<a {href} class={variant}>{@render children()}</a>

<style>
  a {
    display: inline-flex;
    align-items: center;
    min-height: var(--control-height);
    padding: 0 var(--control-padding-x);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-background);
    font-weight: var(--font-weight-medium);
    text-decoration: none;
    white-space: nowrap;
    transition: background var(--motion-fast);
  }
  a:hover {
    background: var(--color-hover);
  }
  .primary {
    border-color: transparent;
    background: var(--color-accent);
    color: var(--color-on-accent);
  }
  .primary:hover {
    background: var(--color-accent);
    filter: brightness(0.94);
  }
</style>
