<script lang="ts">
  import { tick } from 'svelte';
  import { bus, windows } from '../lib/container';
  import { WINDOW_CLOSE } from '../channels';
  import { DOCKS, type Dock } from '../lib/window/WindowService.svelte';
  import Button from './Button.svelte';
  import { withKeys } from './tooltip';

  /**
   * Renders the single detail window. Placement (center, side, bottom) animates between positions;
   * centered it is modal, docked it leaves the page usable next to it.
   */
  const LABELS: Record<Dock, string> = { center: 'Mitte', side: 'Seite', bottom: 'Unten' };
  const HINTS = {
    center: withKeys('Fenster in die Mitte', 'window.center'),
    side: withKeys('Fenster an die Seite', 'window.side'),
    bottom: withKeys('Fenster nach unten', 'window.bottom'),
  } satisfies Record<Dock, string>;

  const target = $derived(windows.current);
  const content = $derived(target ? windows.content(target.kind) : undefined);
  const modal = $derived(windows.dock === 'center');
  const handle = windows.handle();

  let element: HTMLElement | undefined = $state();
  let opener: HTMLElement | null = null;

  // Remember what had focus to return to it; reflect the dock on <html> so the page can make room.
  $effect(() => {
    const open = !!target;
    if (open) {
      opener ??= document.activeElement as HTMLElement | null;
      void tick().then(() => element?.focus());
    } else {
      windows.forgetPush();
      opener?.focus?.();
      opener = null;
    }
  });

  $effect(() => {
    const root = document.documentElement;
    if (target) root.dataset.window = windows.dock;
    else delete root.dataset.window;
    return () => delete root.dataset.window;
  });

  function keydown(event: KeyboardEvent) {
    // Escape is the "window.close" command (see AppController), so it stays configurable.
    if (event.key === 'Tab' && modal && element) {
      trapFocus(event, element);
    }
  }

  function trapFocus(event: KeyboardEvent, container: HTMLElement) {
    const focusable = [...container.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === container)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
</script>

{#if target && content}
  {#if modal}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="backdrop" onclick={() => bus.publish(WINDOW_CLOSE)}></div>
  {/if}
  <div
    bind:this={element}
    class="window {windows.dock}"
    role="dialog"
    aria-modal={modal}
    aria-labelledby="window-title"
    tabindex="-1"
    onkeydown={keydown}
  >
    <header>
      <h2 id="window-title">{windows.title || ' '}</h2>
      <div class="controls">
        <div class="docks" role="group" aria-label="Fensterposition">
          {#each DOCKS as dock (dock)}
            <Button size="sm" variant="ghost" pressed={windows.dock === dock} onclick={() => windows.setDock(dock)}
              tooltip={HINTS[dock]}>{LABELS[dock]}</Button>
          {/each}
        </div>
        {#if content.page}
          <Button size="sm" variant="ghost" onclick={() => handle.navigate(content.page!(target.id))}
            tooltip={withKeys('Als eigene Seite öffnen', 'window.page')}>Als Seite öffnen</Button>
        {/if}
        <Button size="sm" variant="ghost" onclick={() => bus.publish(WINDOW_CLOSE)} tooltip={withKeys('Fenster schließen', 'window.close')}>Schließen</Button>
      </div>
    </header>
    <div class="body">
      {#key `${target.kind}/${target.id}`}
        <content.component id={target.id} {handle} />
      {/key}
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 30;
    background: var(--color-backdrop);
    animation: fade var(--motion-window) var(--motion-easing);
  }
  .window {
    position: fixed;
    z-index: 31;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--color-background);
    box-shadow: var(--color-shadow-window);
    outline: none;
    /* All placements set the same four properties, so moving between them animates. */
    transition:
      top var(--motion-window) var(--motion-easing),
      left var(--motion-window) var(--motion-easing),
      width var(--motion-window) var(--motion-easing),
      height var(--motion-window) var(--motion-easing),
      border-radius var(--motion-window) var(--motion-easing);
    animation: appear var(--motion-window) var(--motion-easing);
  }
  .center {
    top: calc((100dvh - var(--window-center-height)) / 2);
    left: calc((100vw - var(--window-center-width)) / 2);
    width: var(--window-center-width);
    height: var(--window-center-height);
    border-radius: var(--radius-lg);
  }
  .side {
    top: 0;
    left: calc(100vw - var(--window-side-width));
    width: var(--window-side-width);
    height: 100dvh;
    border-radius: 0;
  }
  .bottom {
    top: calc(100dvh - var(--window-bottom-height));
    left: var(--layout-sidebar-width);
    width: calc(100vw - var(--layout-sidebar-width));
    height: var(--window-bottom-height);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  }
  :global([data-layout='compact']) .window {
    top: 0;
    left: 0;
    width: 100vw;
    height: 100dvh;
    border-radius: 0;
  }
  :global([data-layout='compact']) .docks {
    display: none;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-md);
    min-height: 44px;
    padding: var(--space-xs) var(--space-sm) var(--space-xs) var(--space-xl);
    border-bottom: 1px solid var(--color-border);
  }
  h2 {
    margin: 0;
    overflow: hidden;
    color: var(--color-text-muted);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .controls,
  .docks {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 2px;
  }
  .docks {
    margin-right: var(--space-sm);
    padding-right: var(--space-sm);
    border-right: 1px solid var(--color-border);
  }
  .body {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-xl) var(--space-xxl) var(--space-xxl);
  }
  .side .body,
  :global([data-layout='compact']) .body {
    padding: var(--space-lg) var(--space-xl) var(--space-xl);
  }

  @keyframes appear {
    from {
      opacity: 0;
      transform: scale(0.98);
    }
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
  }
</style>
