<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { backStack, bus, commands, router, motion, recentRecords, recordActions, windows } from '../lib/container';
  import { useCommands } from '../lib/keyboard/useCommands.svelte';
  import { copyLinkEntry } from '../lib/window/windowMenu';
  import { menu, openMenuAt, recordMenu } from './contextMenu';
  import { WindowService, provideWindowHandle, type Dock, type OpenWindow } from '../lib/window/WindowService.svelte';
  import { dragWindow, type Box } from '../lib/window/windowDrag';
  import { innerHeight, innerWidth } from 'svelte/reactivity/window';
  import { settings } from '../settings';
  import Button from './Button.svelte';
  import ChoiceGroup, { type Choice } from './ChoiceGroup.svelte';
  import { tooltip, withKeys } from './tooltip';

  /**
   * One detail window (WindowHost renders all). Placement (center, side, bottom) animates between positions. Like the video
   * call it is never modal: the page and the other windows stay usable around it. In the middle its border resizes it.
   */
  let { win }: { win: OpenWindow } = $props();

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
  const EDGES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const;
  type Edge = (typeof EDGES)[number];

  const key = untrack(() => win.key);
  const content = $derived(windows.content(win.kind));
  const title = $derived(windows.title(key));
  const handle = windows.handle(key);
  provideWindowHandle(handle);
  // Each further window in the middle opens a little lower and to the right.
  const cascade = untrack(
    () =>
      Math.max(
        0,
        windows.list.filter((w) => w.dock === 'center').findIndex((w) => w.key === key),
      ) % 6,
  );

  let element: HTMLElement | undefined = $state();
  let moreButton: HTMLElement | undefined = $state();
  let opener: HTMLElement | null = null;
  /** Measures the middle size before a docked window undocks into it. */
  let probe: HTMLElement | undefined = $state();
  /** The dock a drag would take when released now (its preview shows), and the window's box when that preview appeared. */
  let snap = $state<Dock | null>(null);
  let snapFrom: DOMRect | null = null;
  const fade = motion.fade;

  // A command asked for with the opening (e.g. "Bearbeiten" from a context menu) runs once the view handles it.
  $effect(() => {
    const pending = windows.pendingCommand;
    void commands.version;
    if (!pending || pending.kind !== win.kind || pending.id !== win.id || !handle.focused) return;
    if (untrack(() => commands.run(pending.command))) windows.pendingCommand = null;
  });

  const hasActions = $derived(!!recordActions.provider(win.kind));
  const headerMenu = () => recordMenu(win.kind, win.id, { inWindow: true });
  const focusInside = () => !!element?.contains(document.activeElement);
  useCommands(commands, {
    'record.menu': { run: () => moreButton && openMenuAt(moreButton, headerMenu()), when: () => hasActions && focusInside() },
    'record.copyLink': {
      run: () => copyLinkEntry(bus, windows, router, win.kind, win.id).run(),
      when: () => !win.kind.endsWith('-new') && focusInside(),
    },
  });

  // Focus moves into the new window; on closing it returns to what had it, unless it went somewhere else meanwhile.
  $effect(() => {
    opener = document.activeElement as HTMLElement | null;
    void tick().then(() => element?.focus());
    return () => {
      // Only if focus is still in the closing window (or nowhere): never pull it out of the palette or a dialog.
      const active = document.activeElement;
      if (!active || active === document.body || element?.contains(active)) opener?.focus?.();
    };
  });

  /**
   * Minimized, the window shrinks into its footer tab (WindowTabs) and then hides, keeping its content and state;
   * restored, it grows back out of the tab (still drawn while it fades out) to where it was.
   */
  let hidden = $state(untrack(() => win.minimized));
  let shrink: Animation | null = null;
  const tab = () => document.querySelector(`[data-window-tab="${key}"]`)?.getBoundingClientRect();
  $effect(() => {
    const minimized = win.minimized;
    untrack(() => {
      if (!element) return;
      const node = element;
      if (minimized && !hidden) {
        void tick().then(() => {
          const to = tab();
          const hide = () => (hidden = win.minimized);
          if (to) shrink = motion.morphTo(node, to, hide);
          else hide();
        });
      } else if (!minimized) {
        // Restored while still shrinking: it simply stays.
        shrink?.cancel();
        shrink = null;
        if (!hidden) return;
        const from = tab();
        hidden = false;
        void tick().then(() => {
          if (from) motion.morph(node, from);
          node.focus();
        });
      }
    });
  });

  // A position dragged or a size set in the middle holds until the window moves to another placement.
  $effect(() => {
    void win.dock;
    if (element) element.style.top = element.style.left = element.style.width = element.style.height = '';
  });

  const viewport = $derived({ width: innerWidth.current ?? 0, height: innerHeight.current ?? 0 });

  /** The header drags the window (lib/window/windowDrag); a docked one undocks into the middle first. */
  function startMove(event: PointerEvent) {
    if (!element || event.button !== 0 || document.documentElement.dataset.layout === 'compact') return;
    if ((event.target as Element).closest('button, input, label, a')) return;
    const node = element;
    dragWindow(event, {
      element: node,
      docked: win.dock !== 'center',
      middle: () => ({ width: probe?.offsetWidth ?? node.offsetWidth, height: probe?.offsetHeight ?? node.offsetHeight }),
      undock: async () => {
        windows.setDock('center', key);
        await tick();
      },
      snapAt,
      preview: (next) => {
        snapFrom = node.getBoundingClientRect();
        snap = next;
      },
      drop: (dock) => windows.setDock(dock, key),
    });
  }

  function snapAt(box: Box): Dock | null {
    const near = settings.window.drag.snapPx;
    if (box.left + box.width >= window.innerWidth - near) return 'side';
    if (box.top + box.height >= window.innerHeight - near) return 'bottom';
    return null;
  }

  /** Follows the pointer with transitions off (the page too); `move` gets the pointer's offset from where it started. */
  function track(event: PointerEvent, move: (dx: number, dy: number, e: PointerEvent) => void) {
    const grip = event.currentTarget as HTMLElement;
    event.preventDefault();
    event.stopPropagation();
    grip.setPointerCapture(event.pointerId);
    const root = document.documentElement;
    root.dataset.windowResizing = '';
    const start = { x: event.clientX, y: event.clientY };
    const follow = (e: PointerEvent) => move(e.clientX - start.x, e.clientY - start.y, e);
    const end = () => {
      delete root.dataset.windowResizing;
      grip.removeEventListener('pointermove', follow);
      grip.removeEventListener('pointerup', end);
      grip.removeEventListener('pointercancel', end);
    };
    grip.addEventListener('pointermove', follow);
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);
  }

  /** Dragging the inner edge (left at the side, top at the bottom); the page follows. */
  function startResize(event: PointerEvent) {
    const dock = win.dock;
    if (dock === 'center') return;
    track(event, (_dx, _dy, e) => {
      const px = dock === 'side' ? window.innerWidth - e.clientX : window.innerHeight - e.clientY;
      windows.setSize(dock, WindowService.clampSize(dock, px, viewport, settings.window.resize));
    });
  }

  /** Dragging the border of a window in the middle: the dragged edges move, the others stay, within the screen. */
  function startEdge(event: PointerEvent, edge: Edge) {
    if (!element || event.button !== 0) return;
    const node = element;
    const box = node.getBoundingClientRect();
    const { minCenterWidthPx: minW, minCenterHeightPx: minH } = settings.window.resize;
    track(event, (dx, dy) => {
      let { left, top, right, bottom } = box;
      if (edge.includes('w')) left = Math.max(0, Math.min(left + dx, right - minW));
      if (edge.includes('e')) right = Math.min(window.innerWidth, Math.max(right + dx, left + minW));
      if (edge.includes('n')) top = Math.max(0, Math.min(top + dy, bottom - minH));
      if (edge.includes('s')) bottom = Math.min(window.innerHeight, Math.max(bottom + dy, top + minH));
      Object.assign(node.style, { left: `${left}px`, top: `${top}px`, width: `${right - left}px`, height: `${bottom - top}px` });
    });
  }

  function resizeKey(event: KeyboardEvent) {
    const dock = win.dock;
    if (dock === 'center' || !element) return;
    const grow = dock === 'side' ? { ArrowLeft: 1, ArrowRight: -1 }[event.key] : { ArrowUp: 1, ArrowDown: -1 }[event.key];
    if (!grow) return;
    event.preventDefault();
    const box = element.getBoundingClientRect();
    const px = (dock === 'side' ? box.width : box.height) + grow * settings.window.resize.stepPx;
    windows.setSize(dock, WindowService.clampSize(dock, px, viewport, settings.window.resize));
  }

  // Once a record has its title it counts as opened (command palette: "Zuletzt geöffnet").
  // Create forms and settings are no records.
  $effect(() => {
    if (title && !win.kind.endsWith('-new') && win.kind !== 'settings') {
      const record = { kind: win.kind, id: win.id, title };
      untrack(() => recentRecords.remember(record));
    }
  });

  // When the focused control disappears (edit mode ends, a panel closes), keep focus in the window
  // instead of dropping it to <body>, so keyboard users stay where they were. Chrome fires no
  // focusout for removed nodes, so check after each change of the open inner views as well.
  function regainFocus() {
    requestAnimationFrame(() => {
      if (handle.focused && element?.isConnected && (document.activeElement === document.body || !document.activeElement))
        element.focus({ preventScroll: true });
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

  /** Centered windows pop, docked ones slide in from their edge (phones: from the right). */
  function enter(node: Element) {
    const compact = document.documentElement.dataset.layout === 'compact';
    if (!compact && win.dock === 'center') return motion.pop(node, { origin: 'center' });
    return motion.slide(node, { from: !compact && win.dock === 'bottom' ? 'bottom' : 'right' });
  }
</script>

{#if content}
  {#key snap}
    {#if snap}
      <div class="preview {snap}" aria-hidden="true" {@attach (node) => void (snapFrom && motion.morph(node, snapFrom))} out:fade|global></div>
    {/if}
  {/key}
  <div class="probe" bind:this={probe} aria-hidden="true"></div>
  <div
    bind:this={element}
    class="window {win.dock}"
    class:focused={handle.focused}
    class:hidden
    style:z-index={windows.zIndex(key)}
    style:--cascade="{cascade * settings.window.cascadePx}px"
    role="dialog"
    aria-labelledby="window-title-{key}"
    tabindex="-1"
    onpointerdowncapture={() => windows.raise(key)}
    onfocusin={() => windows.raise(key)}
    in:enter
    out:enter
  >
    {#if win.dock === 'center'}
      {#each EDGES as edge (edge)}
        <div class="edge {edge}" aria-hidden="true" onpointerdown={(e) => startEdge(e, edge)}></div>
      {/each}
    {:else}
      <!-- ARIA window splitter: a focusable separator with a value is interactive. -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
      <div
        class="resize"
        role="separator"
        tabindex="0"
        aria-orientation={win.dock === 'side' ? 'vertical' : 'horizontal'}
        aria-label={win.dock === 'side' ? 'Breite des Fensters ändern' : 'Höhe des Fensters ändern'}
        aria-valuenow={windows.size[win.dock] ?? undefined}
        onpointerdown={startResize}
        onkeydown={resizeKey}
        ondblclick={() => win.dock !== 'center' && windows.setSize(win.dock, null)}
        {@attach tooltip('Ziehen zum Ändern der Größe, Doppelklick: Standardgröße')}
      ></div>
    {/if}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <header onpointerdown={startMove}>
      <div class="heading">
        {#if windows.trailDepth(key)}
          <Button
            size="sm"
            variant="ghost"
            icon="back"
            onclick={() => windows.back(key)}
            tooltip={withKeys('Zurück zum vorherigen Eintrag', 'view.back')}
          />
        {/if}
        <h2 id="window-title-{key}" {@attach menu(headerMenu)}>{title || ' '}</h2>
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
            name="window-dock-{key}"
            label="Fensterposition"
            size="sm"
            iconOnly
            options={DOCK_CHOICES}
            bind:value={() => win.dock, (dock) => dock && windows.setDock(dock, key)}
          />
        </div>
        {#if content.page}
          <Button
            size="sm"
            variant="ghost"
            icon="page"
            onclick={() => handle.navigate(content.page!(win.id))}
            tooltip={withKeys('Als eigene Seite öffnen', 'window.page')}
          />
        {/if}
        <Button size="sm" variant="ghost" icon="minimize" onclick={() => windows.minimize(key)} tooltip="Minimieren" />
        <Button
          size="sm"
          variant="ghost"
          icon="close"
          onclick={() => windows.close(undefined, key)}
          tooltip={withKeys('Fenster schließen', 'window.close')}
        />
      </div>
    </header>
    <div class="body">
      {#key `${win.kind}/${win.id}`}
        <content.component id={win.id} {handle} />
      {/key}
    </div>
  </div>
{/if}

<style>
  .window {
    position: fixed;
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
    z-index: 39;
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
    top: calc((100dvh - var(--window-center-height)) / 2 + var(--cascade, 0px));
    left: calc((100vw - var(--window-center-width)) / 2 + var(--cascade, 0px));
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
  /* A window docked at the side keeps the full height; the bottom one ends left of it. */
  :global(:root[data-window-side]:not([data-layout='compact'])) .bottom {
    width: calc(100vw - var(--layout-sidebar-width) - var(--window-side-width));
  }
  /* Room for the video call (CallWindow): docked at the side or left edge, or minimized to its bar. */
  :global(:root[data-call='side']:not([data-layout='compact'])) .bottom {
    width: calc(100vw - var(--layout-sidebar-width) - var(--call-side-width));
  }
  :global(:root[data-call='left']:not([data-layout='compact'])) .bottom {
    left: calc(var(--layout-sidebar-collapsed-width) + var(--call-side-width));
    width: calc(100vw - var(--layout-sidebar-collapsed-width) - var(--call-side-width));
  }
  :global(:root[data-call='left'][data-window-side]:not([data-layout='compact'])) .bottom {
    width: calc(100vw - var(--layout-sidebar-collapsed-width) - var(--call-side-width) - var(--window-side-width));
  }
  /* The footer (minimized call bar, window tabs) stays visible below docked windows. */
  :global(:root:is([data-call='bar'], [data-window-tabs]):not([data-layout='compact'])) .side {
    height: calc(100dvh - var(--call-bar-height));
  }
  :global(:root:is([data-call='bar'], [data-window-tabs]):not([data-layout='compact'])) .bottom {
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
  :global([data-layout='compact']) .resize,
  :global([data-layout='compact']) .edge {
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
  /* The border of a window in the middle: edges and, larger, the corners. */
  .edge {
    position: absolute;
    z-index: 2;
    touch-action: none;
  }
  .edge.n,
  .edge.s {
    left: 12px;
    right: 12px;
    height: 6px;
    cursor: ns-resize;
  }
  .edge.e,
  .edge.w {
    top: 12px;
    bottom: 12px;
    width: 6px;
    cursor: ew-resize;
  }
  .edge.n {
    top: 0;
  }
  .edge.s {
    bottom: 0;
  }
  .edge.e {
    right: 0;
  }
  .edge.w {
    left: 0;
  }
  .edge.ne,
  .edge.nw,
  .edge.se,
  .edge.sw {
    width: 14px;
    height: 14px;
  }
  .edge.nw {
    top: 0;
    left: 0;
    cursor: nwse-resize;
  }
  .edge.se {
    right: 0;
    bottom: 0;
    cursor: nwse-resize;
  }
  .edge.ne {
    top: 0;
    right: 0;
    cursor: nesw-resize;
  }
  .edge.sw {
    bottom: 0;
    left: 0;
    cursor: nesw-resize;
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
  .window.hidden {
    display: none;
  }
  .focused h2 {
    color: var(--color-text);
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
