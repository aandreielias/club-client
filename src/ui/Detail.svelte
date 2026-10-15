<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * Layout of every detail view (task, appointment, member, photo), the same in the window and on
   * a full page: large title, actions, optional tag line, then the content at full width.
   */
  let { title, actions, meta, children }: { title: string; actions?: Snippet; meta?: Snippet; children: Snippet } = $props();
</script>

<div class="detail">
  <header>
    <h1>{title}</h1>
    {#if actions}<div class="actions">{@render actions()}</div>{/if}
  </header>
  {#if meta}<div class="meta">{@render meta()}</div>{/if}
  {@render children()}
</div>

<style>
  .detail {
    display: grid;
    gap: var(--space-lg);
    min-width: 0;
  }
  header {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-md);
  }
  h1 {
    margin: 0;
    font-size: var(--font-size-title);
    overflow-wrap: anywhere;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
    padding-top: var(--space-xs);
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-sm);
    margin-top: calc(-1 * var(--space-sm));
  }
  .detail :global(h2) {
    margin: var(--space-md) 0 0;
    padding-bottom: var(--space-xs);
    border-bottom: 1px solid var(--color-border);
  }
</style>
