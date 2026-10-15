<script lang="ts">
  import type { Snippet } from 'svelte';

  /** The one filter bar: filters and search on the left (`start`), sorting and extras on the right (`end`). */
  let { start, end, label = 'Filtern und sortieren' }: { start?: Snippet; end?: Snippet; label?: string } = $props();
</script>

<div class="toolbar" role="toolbar" aria-label={label}>
  <div class="side">{@render start?.()}</div>
  <div class="side">{@render end?.()}</div>
</div>

<style>
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-sm) var(--space-lg);
    padding-bottom: var(--space-sm);
    border-bottom: 1px solid var(--color-border);
  }
  .side {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-xs) var(--space-sm);
  }
</style>
