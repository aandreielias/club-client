<script lang="ts">
  import type { Snippet } from 'svelte';
  import LinkButton from './LinkButton.svelte';

  /**
   * Heading of a section in pages, windows, settings and the start page: title, optional count or note (e.g. "3 neu"),
   * and on the right a link to the full page or actions. The surrounding layout sets the margins.
   */
  let {
    title,
    count,
    href,
    linkLabel = 'Alle anzeigen',
    note,
    actions,
  }: { title: string; count?: number; href?: string; linkLabel?: string; note?: Snippet; actions?: Snippet } = $props();
</script>

<h2 class="heading">
  {title}
  {#if count !== undefined}<span class="muted note">{count}</span>{/if}
  {#if note}<span class="muted note">{@render note()}</span>{/if}
  {#if href}<span class="end"><LinkButton {href} tooltip="{linkLabel}: {title}">{linkLabel}</LinkButton></span>{/if}
  {#if actions}<span class="end row">{@render actions()}</span>{/if}
</h2>

<style>
  .heading {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-sm);
  }
  .note {
    font-size: var(--font-size-small);
    font-weight: var(--font-weight-medium);
  }
  .end {
    margin-left: auto;
  }
</style>
