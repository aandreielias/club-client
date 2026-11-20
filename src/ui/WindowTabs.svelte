<script lang="ts">
  import { motion, windows } from '../lib/container';
  import Button from './Button.svelte';
  import { tooltip } from './tooltip';
  import { arrowNav } from './arrowNav';

  /**
   * The footer strip of minimized windows: one tab each, the first minimized rightmost. A click grows the window back
   * out of its tab (DetailWindow). The minimized video call's bar shares the strip and ends where the tabs begin.
   */
  const fade = motion.fade;
  let width = $state(0);

  /** Delete on a tab: the focus moves to a neighbour, so the keyboard stays in the strip. */
  function closeTab(button: HTMLElement, key: string) {
    const tab = button.closest('.tab');
    const neighbour = (tab?.nextElementSibling ?? tab?.previousElementSibling)?.querySelector<HTMLElement>('.restore');
    neighbour?.focus();
    windows.close(undefined, key);
  }

  $effect(() => {
    const root = document.documentElement;
    if (!windows.tabs.length) return;
    root.dataset.windowTabs = '';
    root.style.setProperty('--window-tabs-width', `${width}px`);
    return () => {
      delete root.dataset.windowTabs;
      root.style.removeProperty('--window-tabs-width');
    };
  });
</script>

{#if windows.tabs.length}
  <div class="strip" data-area="tabs" role="toolbar" aria-label="Minimierte Fenster" transition:fade|global>
    <div class="tabs" bind:offsetWidth={width} {@attach arrowNav({ items: '.restore', axis: 'horizontal' })}>
      {#each windows.tabs as win (win.key)}
        <div class="tab" data-window-tab={win.key} transition:fade|global>
          <button
            type="button"
            class="restore"
            onclick={() => windows.restore(win.key)}
            onkeydown={(e) => e.key === 'Delete' && (e.preventDefault(), closeTab(e.currentTarget, win.key))}
            {@attach tooltip('Wiederherstellen (Entf: schließen)')}
          >
            <strong>{windows.title(win.key) || 'Fenster'}</strong>
            <span>{windows.content(win.kind)?.label}</span>
          </button>
          <Button size="sm" variant="ghost" icon="close" onclick={() => windows.close(undefined, win.key)} tooltip="Fenster schließen" />
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .strip {
    position: fixed;
    z-index: 30;
    right: 0;
    bottom: 0;
    left: var(--layout-sidebar-width);
    display: flex;
    justify-content: flex-end;
    height: var(--call-bar-height);
    border-top: 1px solid var(--color-border);
    background: var(--color-elevated);
  }
  :global([data-layout='compact']) .strip {
    left: 0;
  }
  .tabs {
    display: flex;
    flex-direction: row-reverse;
    align-items: center;
    align-self: stretch;
    min-width: 0;
    overflow-x: auto;
  }
  /* The minimized call keeps room; the tabs shrink first, then scroll. */
  :global(:root[data-call='bar']) .tabs {
    max-width: calc(100% - var(--call-bar-min-width));
  }
  .tab {
    display: flex;
    flex-shrink: 1;
    width: var(--window-tab-width);
    align-items: center;
    gap: var(--space-xs);
    min-width: var(--window-tab-min-width);
    container-type: inline-size;
    height: 100%;
    padding: 0 var(--space-xs) 0 var(--space-md);
    border-left: 1px solid var(--color-border);
    background: var(--color-elevated);
  }
  .tab:hover {
    background: var(--color-hover);
  }
  .restore {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: flex-start;
    min-width: 0;
    padding: 0;
    border: 0;
    background: none;
    color: var(--color-text);
    font: inherit;
    line-height: 1.25;
    text-align: left;
    cursor: pointer;
  }
  .restore > * {
    overflow: hidden;
    max-width: 100%;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .restore span {
    color: var(--color-text-muted);
    font-size: var(--font-size-small);
  }
  @container (max-width: 180px) {
    .restore span {
      display: none;
    }
  }
</style>
