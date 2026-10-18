<script lang="ts">
  import type { Snippet } from 'svelte';
  import { split } from '../lib/container';
  import { providePane, type Pane } from '../lib/split/Pane';
  import Button from './Button.svelte';

  /**
   * One pane of the split view. Pages inside read their location from this pane; links inside the
   * second pane stay in it; clicking or focusing a pane gives it the keyboard.
   */
  let { pane, label = null, children }: { pane: Pane; label?: string | null; children: Snippet } = $props();

  // svelte-ignore state_referenced_locally
  providePane(pane);

  const focus = () => (split.focused = pane.id);

  /** In the second pane, app links (#/…) change that pane, not the main page. */
  function keepLinksInPane(event: MouseEvent) {
    if (pane.id !== 'split' || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
    const anchor = (event.target as Element).closest('a[href^="#/"]');
    if (!anchor || anchor.getAttribute('target')) return;
    event.preventDefault();
    pane.navigate(anchor.getAttribute('href')!.slice(1));
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section class="pane" class:split={split.isOpen} class:active={split.isOpen && pane.active} aria-label={pane.id === 'split' ? `Geteilte Ansicht: ${label ?? 'Seite'}` : undefined}
  onfocusin={focus} onpointerdown={focus} onclickcapture={keepLinksInPane}>
  {#if pane.id === 'split'}
    <header class="bar">
      <span class="label">{label ?? 'Geteilte Ansicht'}</span>
      <Button size="sm" variant="ghost" onclick={() => split.swap()}>Tauschen</Button>
      <Button size="sm" variant="ghost" icon="close" tooltip="Geteilte Ansicht schließen" onclick={() => split.close()} />
    </header>
  {/if}
  <div class="content">{@render children()}</div>
</section>

<style>
  /* Without a split the page scrolls with the window as before. */
  .pane.split {
    display: flex;
    flex-direction: column;
    min-width: 0;
    height: 100dvh;
  }
  .pane.split .content {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
  .bar {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    min-height: var(--control-height);
    padding: var(--space-xs) var(--space-md);
    border-bottom: 1px solid var(--color-border);
    background: var(--color-surface);
  }
  .label {
    flex: 1;
    overflow: hidden;
    color: var(--color-text-muted);
    font-size: var(--font-size-small);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* The pane that owns the keyboard: a thin accent line on top. */
  .pane.split {
    box-shadow: inset 0 2px 0 transparent;
    transition: box-shadow var(--motion-fast) var(--motion-easing);
  }
  .pane.active {
    box-shadow: inset 0 2px 0 var(--color-accent);
  }
</style>
