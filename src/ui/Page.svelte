<script lang="ts">
  import type { Snippet } from 'svelte';
  import { commands, documentTitle } from '../lib/container';
  import type { MenuEntry } from '../lib/overlay/ContextMenuService.svelte';
  import type { CommandId } from '../shortcuts';
  import { menu } from './contextMenu';
  import { currentPane } from '../lib/split/Pane';
  import Icon from './Icon.svelte';
  import InfoTip from './InfoTip.svelte';

  /**
   * Every page has the same header, top to bottom:
   * back link · title (with an ⓘ `hint` what the page is for) and actions (view switcher first, primary action last) ·
   * context row (breadcrumb, period, season: `context` left, `contextEnd` right) · content.
   */
  let {
    title,
    hint,
    back,
    actions,
    context,
    contextEnd,
    children,
  }: {
    title: string;
    hint?: string;
    back?: { href: string; label: string };
    actions?: Snippet;
    context?: Snippet;
    contextEnd?: Snippet;
    children: Snippet;
  } = $props();

  // The browser tab names the main page; the second pane of a split view has its own header.
  const pane = currentPane();
  $effect(() => {
    if (pane?.id !== 'split') documentTitle.page = title;
  });

  /** Right-click on the page's free space: what its keys do here (new entry, search, reset filters). */
  const PAGE_COMMANDS: readonly CommandId[] = ['page.new', 'list.search', 'list.reset'];
  const pageMenu = (): MenuEntry[] =>
    commands
      .available()
      .filter((c) => PAGE_COMMANDS.includes(c.id))
      .map((c) => ({ label: c.label, command: c.id, icon: c.id === 'page.new' ? 'add' : c.id === 'list.search' ? 'search' : undefined, run: c.run }));
</script>

<article {@attach menu(pageMenu)}>
  <header>
    {#if back}<a class="back muted" href="#{back.href}"><Icon name="back" small />{back.label}</a>{/if}
    <div class="title-row">
      <h1>
        {title}{#if hint}&nbsp;<InfoTip text={hint} />{/if}
      </h1>
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
  /* Holds its height while a breadcrumb or mailbox picker loads, so the content does not jump. */
  .context {
    min-height: var(--control-height);
  }
  h1 {
    margin: 0;
    font-size: var(--font-size-title);
  }
  .actions,
  .side {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-sm);
  }
</style>
