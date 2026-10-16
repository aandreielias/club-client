<script lang="ts">
  import type { Snippet } from 'svelte';
  import LinkButton from './LinkButton.svelte';

  /** Heading of a start page section: title, optional note (e.g. "3 neu") and a link to the full page. */
  let { title, href, linkLabel = 'Alle anzeigen', note }: { title: string; href?: string; linkLabel?: string; note?: Snippet } = $props();
</script>

<h2 class="heading">
  {title}
  {#if note}<span class="muted note">{@render note()}</span>{/if}
  {#if href}<span class="link"><LinkButton {href} tooltip="{linkLabel}: {title}">{linkLabel}</LinkButton></span>{/if}
</h2>

<style>
  .heading {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin: 0;
  }
  .note {
    font-size: var(--font-size-small);
    font-weight: var(--font-weight-medium);
  }
  .link {
    margin-left: auto;
  }
</style>
