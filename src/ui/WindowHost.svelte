<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { backStack, bus, documentTitle, motion, recentRecords, stepUp, windows } from '../lib/container';
  import { WINDOW_CLOSE } from '../channels';
  import { WindowService, type Dock } from '../lib/window/WindowService.svelte';
  import { innerHeight, innerWidth } from 'svelte/reactivity/window';
  import { settings } from '../settings';
  import Button from './Button.svelte';
  import { provideWindowHandle } from './windowContext';
  import ChoiceGroup, { type Choice } from './ChoiceGroup.svelte';
  import { tooltip, withKeys } from './tooltip';

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

  // A PIN prompt before the member has done anything in the window belongs to opening it: the window
  // stays hidden behind the prompt and appears once the PIN is accepted; cancelling closes it.
  // Prompts after that (e.g. on save) leave the window visible.
  let interacted = $state(false);
  const waitingForPin = $derived(!!target && stepUp.open && !interacted);
  let seenCancels = stepUp.cancelled;
  $effect(() => {
    const cancels = stepUp.cancelled;
    if (cancels === seenCancels) return;
    seenCancels = cancels;
    if (untrack(() => !!target && !interacted)) windows.close();
  });

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
      // Only if focus is still in the closing window (or nowhere): never pull it out of the palette or a dialog.
      const active = document.activeElement;
      if (!active || active === document.body || element?.contains(active)) opener?.focus?.();
      opener = null;
    }
  });

  $effect(() => {
    const root = document.documentElement;
    if (target) root.dataset.window = windows.dock;
    else delete root.dataset.window;
    return () => delete root.dataset.window;
  });

  // A dragged size overrides the theme's docked width/height; the page margins (App.svelte) follow.
  const viewport = $derived({ width: innerWidth.current ?? 0, height: innerHeight.current ?? 0 });
  $effect(() => {
    const style = document.documentElement.style;
    for (const [dock, property] of [['side', '--window-side-width'], ['bottom', '--window-bottom-height']] as const) {
      const px = windows.size[dock];
      if (px === null) style.removeProperty(property);
      else style.setProperty(property, `${WindowService.clampSize(dock, px, viewport, settings.window.resize)}px`);
    }
  });

  /** Dragging the inner edge (left at the side, top at the bottom); the page follows without animating. */
  function startResize(event: PointerEvent) {
    const dock = windows.dock;
    if (dock === 'center') return;
    const grip = event.currentTarget as HTMLElement;
    event.preventDefault();
    grip.setPointerCapture(event.pointerId);
    const root = document.documentElement;
    root.dataset.windowResizing = '';
    const move = (e: PointerEvent) => {
      const px = dock === 'side' ? window.innerWidth - e.clientX : window.innerHeight - e.clientY;
      windows.setSize(dock, WindowService.clampSize(dock, px, viewport, settings.window.resize));
    };
    const end = () => {
      delete root.dataset.windowResizing;
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', end);
      grip.removeEventListener('pointercancel', end);
    };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);
  }

  function resizeKey(event: KeyboardEvent) {
    const dock = windows.dock;
    if (dock === 'center' || !element) return;
    const grow = dock === 'side' ? { ArrowLeft: 1, ArrowRight: -1 }[event.key] : { ArrowUp: 1, ArrowDown: -1 }[event.key];
    if (!grow) return;
    event.preventDefault();
    const box = element.getBoundingClientRect();
    const px = (dock === 'side' ? box.width : box.height) + grow * settings.window.resize.stepPx;
    windows.setSize(dock, WindowService.clampSize(dock, px, viewport, settings.window.resize));
  }

  $effect(() => {
    documentTitle.window = target ? windows.title : '';
    // Once a record has its title it counts as opened (command palette: "Zuletzt geöffnet").
    // Create forms and settings are no records.
    if (target && windows.title && !target.kind.endsWith('-new') && target.kind !== 'settings' && !untrack(() => waitingForPin)) {
      const record = { kind: target.kind, id: target.id, title: windows.title };
      untrack(() => recentRecords.remember(record));
    }
  });

  // A new record starts without the previous one's title until it has loaded (also for links opened by URL).
  let shownKey = '';
  $effect(() => {
    const key = target ? `${target.kind}/${target.id}` : '';
    if (key !== shownKey) {
      shownKey = key;
      windows.title = '';
      interacted = false;
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
    <div class="backdrop" class:waiting={waitingForPin} onclick={() => bus.publish(WINDOW_CLOSE)} transition:motion.fade></div>
  {/if}
  <div
    bind:this={element}
    class="window {windows.dock}"
    class:waiting={waitingForPin}
    aria-hidden={waitingForPin}
    role="dialog"
    aria-modal={modal}
    aria-labelledby="window-title"
    tabindex="-1"
    onkeydown={keydown}
    onpointerdown={() => (interacted = true)}
    onkeydowncapture={() => (interacted = true)}
    in:enter
    out:enter
  >
    {#if !modal}
      <!-- ARIA window splitter: a focusable separator with a value is interactive. -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
      <div class="resize" role="separator" tabindex="0" aria-orientation={windows.dock === 'side' ? 'vertical' : 'horizontal'}
        aria-label={windows.dock === 'side' ? 'Breite des Fensters ändern' : 'Höhe des Fensters ändern'}
        aria-valuenow={windows.size[windows.dock === 'side' ? 'side' : 'bottom'] ?? undefined}
        onpointerdown={startResize} onkeydown={resizeKey} ondblclick={() => windows.setSize(windows.dock === 'side' ? 'side' : 'bottom', null)}
        {@attach tooltip('Ziehen zum Ändern der Größe, Doppelklick: Standardgröße')}></div>
    {/if}
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
      border-radius var(--motion-window) var(--motion-easing),
      opacity var(--motion-base) var(--motion-easing),
      scale var(--motion-base) var(--motion-easing);
  }
  .waiting {
    visibility: hidden;
    opacity: 0;
    scale: 0.98;
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
  :global([data-layout='compact']) .docks,
  :global([data-layout='compact']) .resize {
    display: none;
  }
  .resize {
    position: absolute;
    z-index: 1;
    touch-action: none;
  }
  .side .resize {
    inset: 0 auto 0 0;
    width: 6px;
    cursor: col-resize;
  }
  .bottom .resize {
    inset: 0 0 auto;
    height: 6px;
    cursor: row-resize;
  }
  .resize:hover,
  .resize:focus-visible {
    background: var(--color-accent-soft);
    outline: none;
  }
  /* While dragging, size follows the pointer at once. */
  :global(:root[data-window-resizing]) .window,
  :global(:root[data-window-resizing] main) {
    transition: none;
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
