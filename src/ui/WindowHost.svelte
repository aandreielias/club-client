<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { backStack, bus, commands, router, documentTitle, motion, recentRecords, recordActions, windows } from '../lib/container';
  import { useCommands } from '../lib/keyboard/useCommands.svelte';
  import { copyLinkEntry } from '../lib/window/windowMenu';
  import { menu, openMenuAt, recordMenu } from './contextMenu';
  import { WINDOW_CLOSE } from '../channels';
  import { WindowService, type Dock } from '../lib/window/WindowService.svelte';
  import { dragWindow, type Box } from '../lib/window/windowDrag';
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
    center: withKeys('Fenster in die Mitte (beim Ziehen mit Alt: nicht andocken)', 'window.center'),
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
  let moreButton: HTMLElement | undefined = $state();
  let opener: HTMLElement | null = null;
  /** Measures the middle size before a docked window undocks into it. */
  let probe: HTMLElement | undefined = $state();
  /** The dock a drag would take when released now (its preview shows), and the window's box when that preview appeared. */
  let snap = $state<Dock | null>(null);
  let snapFrom: DOMRect | null = null;

  // A command asked for with the opening (e.g. "Bearbeiten" from a context menu) runs once the view handles it.
  $effect(() => {
    const pending = windows.pendingCommand;
    void commands.version;
    if (!pending || pending.kind !== target?.kind || pending.id !== target.id) return;
    if (untrack(() => commands.run(pending.command))) windows.pendingCommand = null;
  });

  const hasActions = $derived(!!target && !!recordActions.provider(target.kind));
  const headerMenu = () => (target ? recordMenu(target.kind, target.id, { inWindow: true }) : []);
  const focusInside = () => !!element?.contains(document.activeElement);
  useCommands(commands, {
    'record.menu': { run: () => moreButton && openMenuAt(moreButton, headerMenu()), when: () => hasActions && focusInside() },
    'record.copyLink': {
      run: () => target && copyLinkEntry(bus, windows, router, target.kind, target.id).run(),
      when: () => !!target && !target.kind.endsWith('-new') && focusInside(),
    },
  });

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
    for (const [dock, property] of [
      ['side', '--window-side-width'],
      ['bottom', '--window-bottom-height'],
    ] as const) {
      const px = windows.size[dock];
      if (px === null) style.removeProperty(property);
      else style.setProperty(property, `${WindowService.clampSize(dock, px, viewport, settings.window.resize)}px`);
    }
  });

  // A position dragged in the middle holds only until the window moves, shows another record or closes.
  $effect(() => {
    void windows.dock;
    void target?.kind;
    void target?.id;
    if (element) element.style.top = element.style.left = '';
  });

  /** The header drags the window (lib/window/windowDrag); a docked one undocks into the middle first. */
  function startMove(event: PointerEvent) {
    if (!element || event.button !== 0 || document.documentElement.dataset.layout === 'compact') return;
    if ((event.target as Element).closest('button, input, label, a')) return;
    const node = element;
    dragWindow(event, {
      element: node,
      docked: windows.dock !== 'center',
      middle: () => ({ width: probe?.offsetWidth ?? node.offsetWidth, height: probe?.offsetHeight ?? node.offsetHeight }),
      undock: async () => {
        windows.setDock('center');
        await tick();
      },
      snapAt,
      preview: (next) => {
        snapFrom = node.getBoundingClientRect();
        snap = next;
      },
      drop: (dock) => windows.setDock(dock),
    });
  }

  function snapAt(box: Box): Dock | null {
    const near = settings.window.drag.snapPx;
    if (box.left + box.width >= window.innerWidth - near) return 'side';
    if (box.top + box.height >= window.innerHeight - near) return 'bottom';
    return null;
  }

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
    if (target && windows.title && !target.kind.endsWith('-new') && target.kind !== 'settings') {
      const record = { kind: target.kind, id: target.id, title: windows.title };
      untrack(() => recentRecords.remember(record));
    }
  });

  // A new record starts without the previous one's title until it has loaded (also for links opened by URL).
  let shownKey = '';
  // pre: runs before the new content mounts, so a create form's fixed title is not wiped after it was set.
  $effect.pre(() => {
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
    const focusable = [
      ...container.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ];
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
  {#key snap}
    {#if snap}
      <div class="preview {snap}" aria-hidden="true" {@attach (node) => void (snapFrom && motion.morph(node, snapFrom))} out:motion.fade|global></div>
    {/if}
  {/key}
  <div class="probe" bind:this={probe} aria-hidden="true"></div>
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
    {#if !modal}
      <!-- ARIA window splitter: a focusable separator with a value is interactive. -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
      <div
        class="resize"
        role="separator"
        tabindex="0"
        aria-orientation={windows.dock === 'side' ? 'vertical' : 'horizontal'}
        aria-label={windows.dock === 'side' ? 'Breite des Fensters ändern' : 'Höhe des Fensters ändern'}
        aria-valuenow={windows.size[windows.dock === 'side' ? 'side' : 'bottom'] ?? undefined}
        onpointerdown={startResize}
        onkeydown={resizeKey}
        ondblclick={() => windows.setSize(windows.dock === 'side' ? 'side' : 'bottom', null)}
        {@attach tooltip('Ziehen zum Ändern der Größe, Doppelklick: Standardgröße')}
      ></div>
    {/if}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <header onpointerdown={startMove}>
      <div class="heading">
        {#if windows.trailDepth}
          <Button
            size="sm"
            variant="ghost"
            icon="back"
            onclick={() => windows.back()}
            tooltip={withKeys('Zurück zum vorherigen Eintrag', 'view.back')}
          />
        {/if}
        <h2 id="window-title" {@attach menu(headerMenu)}>{windows.title || ' '}</h2>
      </div>
      <div class="controls">
        {#if hasActions}
          <span class="more" bind:this={moreButton}>
            <Button
              size="sm"
              variant="ghost"
              icon="more"
              onclick={() => moreButton && openMenuAt(moreButton, headerMenu())}
              tooltip={withKeys('Weitere Aktionen', 'record.menu')}
            />
          </span>
        {/if}
        <div class="docks">
          <ChoiceGroup
            name="window-dock"
            label="Fensterposition"
            size="sm"
            iconOnly
            options={DOCK_CHOICES}
            bind:value={() => windows.dock, (dock) => dock && windows.setDock(dock)}
          />
        </div>
        {#if content.page}
          <Button
            size="sm"
            variant="ghost"
            icon="page"
            onclick={() => handle.navigate(content.page!(target.id))}
            tooltip={withKeys('Als eigene Seite öffnen', 'window.page')}
          />
        {/if}
        <Button
          size="sm"
          variant="ghost"
          icon="close"
          onclick={() => bus.publish(WINDOW_CLOSE)}
          tooltip={withKeys('Fenster schließen', 'window.close')}
        />
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
  .preview {
    position: fixed;
    z-index: 31;
    /* Neutral grey: grey on a white page, light on a dark one. */
    background: color-mix(in oklab, var(--color-text) 14%, transparent);
    backdrop-filter: blur(2px);
    pointer-events: none;
  }
  .probe {
    position: fixed;
    width: var(--window-center-width);
    height: var(--window-center-height);
    visibility: hidden;
    pointer-events: none;
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
  /* Room for the video call (CallWindow): docked at the side or left edge, or minimized to its bar. */
  :global(:root[data-call='side']:not([data-layout='compact'])) .bottom {
    width: calc(100vw - var(--layout-sidebar-width) - var(--call-side-width));
  }
  :global(:root[data-call='left']:not([data-layout='compact'])) .bottom {
    left: calc(var(--layout-sidebar-collapsed-width) + var(--call-side-width));
    width: calc(100vw - var(--layout-sidebar-collapsed-width) - var(--call-side-width));
  }
  :global(:root[data-call='bar']:not([data-layout='compact'])) .side {
    height: calc(100dvh - var(--call-bar-height));
  }
  :global(:root[data-call='bar']:not([data-layout='compact'])) .bottom {
    top: calc(100dvh - var(--window-bottom-height) - var(--call-bar-height));
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
    cursor: grab;
    touch-action: none;
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
  .more {
    display: contents;
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
