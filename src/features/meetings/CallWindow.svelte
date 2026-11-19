<script lang="ts">
  import { onDestroy } from 'svelte';
  import { innerHeight, innerWidth } from 'svelte/reactivity/window';
  import { WindowService } from '../../lib/window/WindowService.svelte';
  import { settings } from '../../settings';
  import Button from '../../ui/Button.svelte';
  import ChoiceGroup, { type Choice } from '../../ui/ChoiceGroup.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import { tooltip } from '../../ui/tooltip';
  import { SELF } from './CallSession.svelte';
  import type { CallLayout, CallPlacement } from './CallService.svelte';
  import { calls } from './services';

  /**
   * The video call as a floating window over the app (never modal): middle, side or bottom like the detail window, at the left
   * edge when the detail window holds the same one, resizable, full screen, minimized to a bar. Phones show it full screen.
   * Minimized, the tiles stay mounted (hidden) so the others are still heard.
   */
  interface Tile {
    id: string;
    name: string;
    stream: MediaStream;
    video: boolean;
    muted: boolean;
  }

  const LAYOUTS: readonly Choice<CallLayout>[] = [
    { value: 'gallery', label: 'Galerie', icon: 'gallery', hint: 'Alle gleich groß' },
    { value: 'speaker', label: 'Sprecher', icon: 'speaker', hint: 'Wer spricht, groß' },
  ];
  const limits = { ...settings.window.resize, minSidePx: settings.meetings.callMinSidePx, minBottomPx: settings.meetings.callMinBottomPx };

  const call = $derived(calls.session);
  const dock = $derived(calls.dock);
  const placements = $derived<Choice<CallPlacement>[]>([
    { value: 'center', label: 'Mitte', icon: 'dockCenter', hint: 'Videokonferenz in die Mitte' },
    { value: 'side', label: 'Seite', icon: 'dockSide', hint: 'Videokonferenz an die Seite' },
    {
      value: 'bottom',
      label: 'Unten',
      icon: 'dockBottom',
      hint: calls.bottomTaken ? 'Unten ist schon das Fenster angedockt' : 'Videokonferenz nach unten',
      disabled: calls.bottomTaken,
    },
  ]);
  const tiles = $derived.by<Tile[]>(() => {
    if (!call) return [];
    const own = call.local
      ? [{ id: SELF, name: 'Du', stream: call.local, video: call.cameraOn && call.local.getVideoTracks().length > 0, muted: !call.micOn }]
      : [];
    const others = call.peers.map((p) => ({
      id: p.memberId,
      name: p.name,
      stream: p.stream,
      video: p.stream.getVideoTracks().length > 0,
      muted: false,
    }));
    return [...own, ...others];
  });
  const featured = $derived(
    calls.layout === 'speaker' ? (tiles.find((t) => t.id === call?.featured) ?? tiles.find((t) => t.id !== SELF) ?? tiles[0]) : undefined,
  );
  const speaker = $derived(tiles.find((t) => t.id === call?.speaking)?.name);
  const viewport = $derived({ width: innerWidth.current ?? 0, height: innerHeight.current ?? 0 });

  let element: HTMLElement | undefined = $state();
  let fullscreen = $state(false);

  // The page makes room for the docked call and the bar (App.svelte, WindowHost.svelte).
  $effect(() => {
    const root = document.documentElement;
    if (!call) return;
    root.dataset.call = calls.minimized ? 'bar' : dock;
    return () => delete root.dataset.call;
  });

  // A dragged size overrides the theme's; the page margins follow.
  $effect(() => {
    const style = document.documentElement.style;
    for (const [edge, property] of [
      ['side', '--call-side-width'],
      ['bottom', '--call-bottom-height'],
    ] as const) {
      const px = calls.size[edge];
      if (px === null) style.removeProperty(property);
      else style.setProperty(property, `${WindowService.clampSize(edge, px, viewport, limits)}px`);
    }
  });

  // The middle placement is dragged and resized by hand; its position and size must not stick to the docked ones.
  $effect(() => {
    void dock;
    void calls.minimized;
    void fullscreen;
    if (element) element.style.width = element.style.height = element.style.top = element.style.left = '';
  });

  /** In the middle, the header drags the window anywhere on the screen (not off it). */
  function startMove(event: PointerEvent) {
    const header = event.currentTarget as HTMLElement;
    if (!element || dock !== 'center' || fullscreen || event.button !== 0) return;
    if ((event.target as Element).closest('button, input, label') || document.documentElement.dataset.layout === 'compact') return;
    const box = element.getBoundingClientRect();
    const [dx, dy] = [event.clientX - box.left, event.clientY - box.top];
    event.preventDefault();
    header.setPointerCapture(event.pointerId);
    const root = document.documentElement;
    root.dataset.windowResizing = '';
    const move = (e: PointerEvent) => {
      if (!element) return;
      const { width, height } = element.getBoundingClientRect();
      element.style.left = `${Math.max(0, Math.min(e.clientX - dx, window.innerWidth - width))}px`;
      element.style.top = `${Math.max(0, Math.min(e.clientY - dy, window.innerHeight - height))}px`;
    };
    const end = () => {
      delete root.dataset.windowResizing;
      header.removeEventListener('pointermove', move);
      header.removeEventListener('pointerup', end);
      header.removeEventListener('pointercancel', end);
    };
    header.addEventListener('pointermove', move);
    header.addEventListener('pointerup', end);
    header.addEventListener('pointercancel', end);
  }

  function media(video: HTMLVideoElement, stream: MediaStream) {
    video.srcObject = stream;
    return { update: (next: MediaStream) => (video.srcObject = next) };
  }

  function initials(name: string): string {
    return name
      .split(/\s+/)
      .map((part) => part[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  const edge = () => (dock === 'bottom' ? 'bottom' : 'side');

  /** Dragging the inner edge (left at the side, right at the left edge, top at the bottom). */
  function startResize(event: PointerEvent) {
    if (!element) return;
    const grip = event.currentTarget as HTMLElement;
    const box = element.getBoundingClientRect();
    event.preventDefault();
    grip.setPointerCapture(event.pointerId);
    const root = document.documentElement;
    root.dataset.windowResizing = '';
    const move = (e: PointerEvent) => {
      const px = dock === 'bottom' ? window.innerHeight - e.clientY : dock === 'left' ? e.clientX - box.left : window.innerWidth - e.clientX;
      calls.setSize(edge(), WindowService.clampSize(edge(), px, viewport, limits));
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
    if (!element) return;
    const keys: Record<string, Record<string, number>> = {
      side: { ArrowLeft: 1, ArrowRight: -1 },
      left: { ArrowRight: 1, ArrowLeft: -1 },
      bottom: { ArrowUp: 1, ArrowDown: -1 },
    };
    const grow = keys[dock]?.[event.key];
    if (!grow) return;
    event.preventDefault();
    const box = element.getBoundingClientRect();
    const px = (dock === 'bottom' ? box.height : box.width) + grow * limits.stepPx;
    calls.setSize(edge(), WindowService.clampSize(edge(), px, viewport, limits));
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void element?.requestFullscreen();
  }

  function minimize() {
    if (document.fullscreenElement) void document.exitFullscreen();
    calls.minimized = true;
  }

  onDestroy(() => void calls.leave());
</script>

<svelte:window onpagehide={() => void calls.leave(false)} />
<svelte:document onfullscreenchange={() => (fullscreen = !!element && document.fullscreenElement === element)} />

{#if call && calls.meeting}
  <!-- The bar opens the call again on a click anywhere but its buttons; keyboard users have the restore button. -->
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
  <section
    bind:this={element}
    class="call {dock}"
    class:bar={calls.minimized}
    aria-label="Videokonferenz: {calls.meeting.title}"
    onclick={(e) => calls.minimized && !(e.target as Element).closest('button') && (calls.minimized = false)}
  >
    {#if calls.minimized}
      <span class="live" aria-hidden="true"></span>
      <div class="summary">
        <strong>{calls.meeting.title}</strong>
        <span>{tiles.length} in der Videokonferenz{speaker ? ` · spricht: ${speaker}` : ''}</span>
      </div>
      {@render toggles()}
      <Button size="sm" variant="ghost" icon="restore" tooltip="Videokonferenz wieder öffnen" onclick={() => (calls.minimized = false)} />
      <Button size="sm" variant="danger" icon="hangUp" onclick={() => void calls.leave()}>Verlassen</Button>
    {:else}
      {#if dock !== 'center' && !fullscreen}
        <!-- ARIA window splitter, as in WindowHost. -->
        <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
        <div
          class="resize"
          role="separator"
          tabindex="0"
          aria-orientation={dock === 'bottom' ? 'horizontal' : 'vertical'}
          aria-label={dock === 'bottom' ? 'Höhe der Videokonferenz ändern' : 'Breite der Videokonferenz ändern'}
          onpointerdown={startResize}
          onkeydown={resizeKey}
          ondblclick={() => calls.setSize(edge(), null)}
          {@attach tooltip('Ziehen zum Ändern der Größe, Doppelklick: Standardgröße')}
        ></div>
      {/if}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <header onpointerdown={startMove}>
        <h2>{calls.meeting.title}</h2>
        <div class="controls">
          <ChoiceGroup
            name="call-layout"
            label="Ansicht"
            size="sm"
            iconOnly
            options={LAYOUTS}
            bind:value={() => calls.layout, (layout) => layout && calls.setLayout(layout)}
          />
          {#if !fullscreen}
            <div class="docks">
              <ChoiceGroup
                name="call-dock"
                label="Position der Videokonferenz"
                size="sm"
                iconOnly
                options={placements}
                bind:value={() => calls.placement, (placement) => placement && calls.place(placement)}
              />
            </div>
          {/if}
          <span class="wide">
            <Button
              size="sm"
              variant="ghost"
              icon={fullscreen ? 'fullscreenExit' : 'fullscreen'}
              tooltip={fullscreen ? 'Vollbild beenden' : 'Vollbild'}
              onclick={toggleFullscreen}
            />
          </span>
          <Button
            size="sm"
            variant="ghost"
            icon="minimize"
            tooltip="Minimieren: die App bleibt frei, die Videokonferenz läuft weiter"
            onclick={minimize}
          />
        </div>
      </header>
    {/if}

    <div class="stage" class:speaker={!!featured} hidden={calls.minimized}>
      {#if !call.joined}
        <p class="connecting">Verbinden …</p>
      {:else}
        {#if featured}
          <div class="featured">{@render tile(featured)}</div>
        {/if}
        <div class="tiles">
          {#each tiles as t (t.id)}
            {#if t !== featured}{@render tile(t)}{/if}
          {/each}
        </div>
      {/if}
    </div>

    {#if !calls.minimized}
      <footer>
        {@render toggles()}
        <Button size="sm" variant="danger" icon="hangUp" onclick={() => void calls.leave()}>Verlassen</Button>
      </footer>
      <ErrorNote error={calls.error} />
    {/if}
  </section>
{/if}

{#snippet tile(t: Tile)}
  <figure class:speaking={call?.speaking === t.id} class:self={t.id === SELF}>
    <!-- Always mounted: it also plays the participant's sound. -->
    <video use:media={t.stream} autoplay playsinline muted={t.id === SELF} class:off={!t.video}></video>
    {#if !t.video}<span class="avatar" aria-hidden="true">{initials(t.name)}</span>{/if}
    <figcaption>{t.name}{t.muted ? ' (stumm)' : ''}</figcaption>
  </figure>
{/snippet}

{#snippet toggles()}
  {#if call?.local?.getAudioTracks().length}
    <Button
      size="sm"
      icon={call.micOn ? 'mic' : 'micOff'}
      pressed={!call.micOn}
      tooltip={call.micOn ? 'Mikrofon aus' : 'Mikrofon an'}
      onclick={() => call?.toggleMic()}
    />
  {/if}
  {#if call?.local?.getVideoTracks().length}
    <Button
      size="sm"
      icon={call.cameraOn ? 'camera' : 'cameraOff'}
      pressed={!call.cameraOn}
      tooltip={call.cameraOn ? 'Kamera aus' : 'Kamera an'}
      onclick={() => call?.toggleCamera()}
    />
  {/if}
{/snippet}

<style>
  .call {
    /* Brand-tinted dark stage in light and dark mode; the shared controls read their colours from these. */
    --call-bg: color-mix(in oklab, var(--color-accent) var(--call-tint), black);
    --color-text: var(--color-on-accent);
    --color-text-muted: color-mix(in oklab, var(--color-on-accent) 72%, transparent);
    --color-hover: color-mix(in oklab, var(--color-on-accent) 12%, transparent);
    --color-elevated: color-mix(in oklab, var(--color-on-accent) 22%, var(--call-bg));
    --color-border: color-mix(in oklab, var(--color-on-accent) 16%, transparent);
    position: fixed;
    z-index: 32;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--call-bg);
    color: var(--color-text);
    box-shadow: var(--color-shadow-window);
    transition:
      top var(--motion-window) var(--motion-easing),
      left var(--motion-window) var(--motion-easing),
      width var(--motion-window) var(--motion-easing),
      height var(--motion-window) var(--motion-easing),
      border-radius var(--motion-window) var(--motion-easing);
  }
  .center {
    top: calc((100dvh - var(--call-center-height)) / 2);
    left: calc((100vw - var(--call-center-width)) / 2);
    width: var(--call-center-width);
    height: var(--call-center-height);
    min-width: 320px;
    min-height: 240px;
    max-width: 100vw;
    max-height: 100dvh;
    border-radius: var(--radius-xl);
    resize: both;
  }
  .side {
    top: 0;
    left: calc(100vw - var(--call-side-width));
    width: var(--call-side-width);
    height: 100dvh;
  }
  .left {
    top: 0;
    left: var(--layout-sidebar-collapsed-width);
    width: var(--call-side-width);
    height: 100dvh;
  }
  .bottom {
    top: calc(100dvh - var(--call-bottom-height));
    left: var(--layout-sidebar-width);
    width: calc(100vw - var(--layout-sidebar-width));
    height: var(--call-bottom-height);
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  }
  /* Next to the docked detail window: the side call ends above a bottom window, the bottom call left of a side window. */
  :global(:root[data-window='bottom']) .side:not(.bar) {
    height: calc(100dvh - var(--window-bottom-height));
  }
  :global(:root[data-window='side']) .bottom:not(.bar) {
    width: calc(100vw - var(--layout-sidebar-width) - var(--window-side-width));
  }
  .call.bar {
    cursor: pointer;
    top: calc(100dvh - var(--call-bar-height));
    left: var(--layout-sidebar-width);
    width: calc(100vw - var(--layout-sidebar-width));
    height: var(--call-bar-height);
    min-width: 0;
    min-height: 0;
    flex-direction: row;
    align-items: center;
    gap: var(--space-sm);
    padding: 0 var(--space-lg);
    border-radius: 0;
    resize: none;
  }
  .call:fullscreen {
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    border-radius: 0;
    resize: none;
  }
  :global([data-layout='compact']) .call:not(.bar) {
    top: 0;
    left: 0;
    width: 100vw;
    height: 100dvh;
    border-radius: 0;
    resize: none;
  }
  :global([data-layout='compact']) .call.bar {
    left: 0;
    width: 100vw;
  }
  :global([data-layout='compact']) .docks,
  :global([data-layout='compact']) .wide,
  :global([data-layout='compact']) .resize {
    display: none;
  }
  :global(:root[data-window-resizing]) .call {
    transition: none;
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
  .left .resize {
    inset: 0 0 0 auto;
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
    background: var(--color-hover);
    outline: none;
  }

  .center header {
    cursor: move;
    touch-action: none;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-md);
    min-height: 46px;
    padding: var(--space-xs) var(--space-sm) var(--space-xs) var(--space-xl);
  }
  h2 {
    margin: 0;
    overflow: hidden;
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .controls {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: var(--space-xs);
  }
  .docks {
    padding: 0 var(--space-xs);
    border-left: 1px solid var(--color-border);
    border-right: 1px solid var(--color-border);
  }
  .wide {
    display: contents;
  }

  .stage {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: var(--space-sm);
    min-height: 0;
    padding: 0 var(--space-md);
  }
  .stage[hidden] {
    display: none;
  }
  .connecting {
    margin: auto;
    color: var(--color-text-muted);
  }
  .tiles {
    display: grid;
    flex: 1;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
    align-content: center;
    gap: var(--space-sm);
    min-height: 0;
    overflow-y: auto;
  }
  .featured {
    display: flex;
    flex: 1;
    min-height: 0;
  }
  .featured figure {
    flex: 1;
    aspect-ratio: auto;
  }
  .speaker .tiles {
    display: flex;
    flex: none;
    gap: var(--space-sm);
    overflow-x: auto;
  }
  .speaker .tiles figure {
    flex: 0 0 9rem;
  }
  figure {
    position: relative;
    display: grid;
    place-items: center;
    margin: 0;
    overflow: hidden;
    aspect-ratio: 16 / 9;
    border-radius: var(--radius-md);
    background: var(--color-hover);
    outline: 3px solid transparent;
    outline-offset: -3px;
    transition: outline-color var(--motion-fast) var(--motion-easing);
  }
  figure.speaking {
    outline-color: color-mix(in oklab, var(--color-accent) 45%, var(--color-on-accent));
  }
  video {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .self video {
    transform: scaleX(-1);
  }
  video.off {
    visibility: hidden;
  }
  .avatar {
    display: grid;
    place-items: center;
    width: 3.5rem;
    height: 3.5rem;
    border-radius: 50%;
    background: color-mix(in oklab, var(--color-accent) 70%, var(--call-bg));
    font-weight: var(--font-weight-medium);
  }
  figcaption {
    position: absolute;
    left: var(--space-sm);
    bottom: var(--space-sm);
    padding: 0 var(--space-xs);
    border-radius: var(--radius-sm);
    background: color-mix(in oklab, var(--call-bg) 70%, transparent);
    font-size: var(--font-size-small);
  }
  footer {
    display: flex;
    justify-content: center;
    gap: var(--space-xs);
    padding: var(--space-sm);
  }

  .live {
    flex-shrink: 0;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-success);
  }
  .summary {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    line-height: 1.25;
  }
  .summary > * {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .summary span {
    color: var(--color-text-muted);
    font-size: var(--font-size-small);
  }
</style>
