<script lang="ts">
  import { tick } from 'svelte';
  import { backStack, bus, documentTitle, motion, windows } from '../lib/container';
  import { WINDOW_CLOSE } from '../channels';
  import { type Dock } from '../lib/window/WindowService.svelte';
  import Button from './Button.svelte';
  import { provideWindowHandle } from './windowContext';
  import ChoiceGroup, { type Choice } from './ChoiceGroup.svelte';
  import { withKeys } from './tooltip';

  /**
   * Renders the single detail window. Placement (center, side, bottom) animates between positions;
   * centered it is modal, docked it leaves the page usable next to it.
   */
  const HINTS = {
    center: withKeys('Fenster in die Mitte', 'window.center'),
    side: withKeys('Fenster an die Seite', 'window.side'),
    bottom: withKeys('Fenster nach unten', 'window.bottom'),
  } satisfies Record<Dock, string>;
  const DOCK_CHOICES: readonly Choice<Dock>[] = [
    { value: 'center', label: 'Mitte', icon: 'dockCenter', hint: HINTS.center },
    { value: 'side', label: 'Seite', icon: 'dockSide', hint: HINTS.side },
    { value: 'bottom', label: 'Unten', icon: 'dockBottom', hint: HINTS.bottom },
  ];

  const target = $derived(windows.current);
  const content = $derived(target ? windows.content(target.kind) : undefined);
  const modal = $derived(windows.dock === 'center');
  const handle = windows.handle();
  provideWindowHandle(handle);

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

  $effect(() => {
    documentTitle.window = target ? windows.title : '';
  });

  // A new record starts without the previous one's title until it has loaded (also for links opened by URL).
  let shownKey = '';
  $effect(() => {
    const key = target ? `${target.kind}/${target.id}` : '';
    if (key !== shownKey) {
      shownKey = key;
      windows.title = '';
    }
  });

  // When the focused control disappears (edit mode ends, a panel closes), keep focus in the window
  // instead of dropping it to <body>, so keyboard users stay where they were. Chrome fires no
  // focusout for removed nodes, so check after each change of the open inner views as well.
  function regainFocus() {
    requestAnimationFrame(() => {
      if (element?.isConnected && (document.activeElement === document.body || !document.activeElement)) element.focus({ preventScroll: true });
    });
  }
  $effect(() => {
    void backStack.depth;
    regainFocus();
  });
  $effect(() => {
    const node = element;
    if (!node) return;
    const lost = (event: FocusEvent) => !event.relatedTarget && regainFocus();
    node.addEventListener('focusout', lost);
    return () => node.removeEventListener('focusout', lost);
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

  /** Centered windows pop, docked ones slide in from their edge (phones: from the right). */
  function enter(node: Element) {
    const compact = document.documentElement.dataset.layout === 'compact';
    if (!compact && windows.dock === 'center') return motion.pop(node, { origin: 'center' });
    return motion.slide(node, { from: !compact && windows.dock === 'bottom' ? 'bottom' : 'right' });
  }
</script>

{#if target && content}
  {#if modal}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="backdrop" onclick={() => bus.publish(WINDOW_CLOSE)} transition:motion.fade></div>
  {/if}
  <div
    bind:this={element}
    class="window {windows.dock}"
    role="dialog"
    aria-modal={modal}
    aria-labelledby="window-title"
    tabindex="-1"
    onkeydown={keydown}
    in:enter
    out:enter
  >
    <header>
      <div class="heading">
        {#if windows.trailDepth}
          <Button size="sm" variant="ghost" icon="back" onclick={() => windows.back()} tooltip={withKeys('Zurück zum vorherigen Eintrag', 'view.back')} />
        {/if}
        <h2 id="window-title">{windows.title || ' '}</h2>
      </div>
      <div class="controls">
        <div class="docks">
          <ChoiceGroup name="window-dock" label="Fensterposition" size="sm" iconOnly options={DOCK_CHOICES}
            bind:value={() => windows.dock, (dock) => dock && windows.setDock(dock)} />
        </div>
        {#if content.page}
          <Button size="sm" variant="ghost" icon="page" onclick={() => handle.navigate(content.page!(target.id))}
            tooltip={withKeys('Als eigene Seite öffnen', 'window.page')} />
        {/if}
        <Button size="sm" variant="ghost" icon="close" onclick={() => bus.publish(WINDOW_CLOSE)} tooltip={withKeys('Fenster schließen', 'window.close')} />
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
  }
  .window {
    position: fixed;
    z-index: 31;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--color-elevated);
    box-shadow: var(--color-shadow-window);
    outline: none;
    /* All placements set the same four properties, so moving between them animates. */
    transition:
      top var(--motion-window) var(--motion-easing),
      left var(--motion-window) var(--motion-easing),
      width var(--motion-window) var(--motion-easing),
      height var(--motion-window) var(--motion-easing),
      border-radius var(--motion-window) var(--motion-easing);
  }
  .center {
    top: calc((100dvh - var(--window-center-height)) / 2);
    left: calc((100vw - var(--window-center-width)) / 2);
    width: var(--window-center-width);
    height: var(--window-center-height);
    border-radius: var(--radius-xl);
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
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
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
    min-height: 46px;
    padding: var(--space-xs) var(--space-sm) var(--space-xs) var(--space-xl);
    border-bottom: 1px solid var(--color-border);
  }
  .heading {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    min-width: 0;
  }
  .heading :global(.button) {
    margin-left: calc(-1 * var(--space-sm));
    animation: rise var(--motion-base) var(--motion-easing);
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

  /* Switching records inside the window: the new content rises in. */
  .body > :global(*) {
    animation: rise var(--motion-slow) var(--motion-easing) both;
  }
</style>
