<script lang="ts">
  import type { Snippet } from 'svelte';
  import { documentTitle } from '../lib/container';
  import Icon from './Icon.svelte';

  /**
   * Every page has the same header, top to bottom:
   * back link · title with actions (view switcher first, primary action last) ·
   * context row (breadcrumb, period, season: `context` left, `contextEnd` right) · content.
   */
  let {
    title,
    back,
    actions,
    context,
    contextEnd,
    children,
  }: {
    title: string;
    back?: { href: string; label: string };
    actions?: Snippet;
    context?: Snippet;
    contextEnd?: Snippet;
    children: Snippet;
  } = $props();

  $effect(() => {
    documentTitle.page = title;
  });
</script>

<article>
  <header>
    {#if back}<a class="back muted" href="#{back.href}"><Icon name="back" small />{back.label}</a>{/if}
    <div class="title-row">
      <h1>{title}</h1>
      {#if actions}<div class="actions">{@render actions()}</div>{/if}
    </div>
    {#if context || contextEnd}
      <div class="context">
        <div class="side">{@render context?.()}</div>
        <div class="side">{@render contextEnd?.()}</div>
      </div>
    {/if}
  </header>
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
  header {
    display: grid;
    gap: var(--space-md);
    margin-bottom: var(--space-lg);
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    margin-left: -4px;
    justify-self: start;
    font-size: var(--font-size-small);
    text-decoration: none;
  }
  .back:hover {
    color: var(--color-text);
  }
  .title-row,
  .context {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-sm) var(--space-md);
  }
  h1 {
    margin: 0;
    font-size: var(--font-size-title);
    letter-spacing: -0.02em;
  }
  .actions,
  .side {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-sm);
  }
</style>
