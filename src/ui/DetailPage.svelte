<script lang="ts">
  import type { Snippet } from 'svelte';

  /** Full-page frame for a detail view ("Als Seite öffnen"): back link plus the view itself. */
  let { back, children }: { back: { href: string; label: string }; children: Snippet } = $props();
</script>

<article>
  <a class="back muted" href="#{back.href}">{back.label}</a>
  {@render children()}
</article>

<style>
  article {
    max-width: var(--layout-content-width);
    margin: 0 auto;
    padding: var(--space-xxl);
  }
  :global([data-layout='compact']) article {
    padding: calc(var(--space-xxl) + var(--space-sm)) var(--space-lg) var(--space-xl);
  }
  .back {
    display: inline-block;
    margin-bottom: var(--space-lg);
    font-size: var(--font-size-small);
    text-decoration: none;
  }
  .back:hover {
    color: var(--color-text);
  }
</style>
