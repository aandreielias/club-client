<script lang="ts">
  import { bus, router, session, windows } from '../../lib/container';
  import { NAVIGATE, WINDOW_OPEN } from '../../channels';
  import type { CalendarEntry } from '../../lib/calendar/CalendarSources';
  import { windowMenu } from '../../lib/window/windowMenu';
  import { menu } from '../../ui/contextMenu';
  import { tooltip } from '../../ui/tooltip';
  import type { CalendarDrag, ResizeEdge, ResizeMode } from './CalendarDrag';
  import type { CalendarResize } from './CalendarResize';
  import { RecordDrag } from '../../lib/records/RecordDrag';

  /** One calendar entry as a compact, clickable chip in the entry's hue. */
  let {
    entry,
    showTime = true,
    fill = false,
    before = false,
    after = false,
    drag,
    resize = null,
    resizer,
  }: {
    entry: CalendarEntry;
    showTime?: boolean;
    fill?: boolean;
    /** A bar across days that started before / goes on after the shown week: its edge stays open. */
    before?: boolean;
    after?: boolean;
    drag?: CalendarDrag;
    /** Edges that change the length: days (left/right) or time (top/bottom); null = none. */
    resize?: ResizeMode | null;
    resizer?: CalendarResize;
  } = $props();

  // Day edges only where days are the length (all-day or across days): on a timed one-day chip they would catch the grab for moving.
  const spansDays = $derived(
    !!entry.end &&
      (entry.allDay || before || after || session.clock.localDate(entry.start) !== session.clock.localDate(new Date(Date.parse(entry.end) - 1))),
  );
  const handles = $derived(!!resizer && !!resize && entry.resizable && !!entry.end && (resize === 'time' || spansDays));
  // A bar that runs on beyond the week has no edge there to pull.
  const edges = $derived<ResizeEdge[]>(
    resize === 'time' ? ['start', 'end'] : [...(before ? [] : ['start' as const]), ...(after ? [] : ['end' as const])],
  );

  const time = $derived(showTime ? session.format.time(entry.start) : '');
  const hint = $derived(`${entry.label}: ${entry.title}\n${when()}`);
  /** A record opens in the window; absences and offices have pages instead. */
  function open() {
    if (entry.window) bus.publish(WINDOW_OPEN, { kind: entry.window.kind, id: entry.window.id });
    else if (entry.path) bus.publish(NAVIGATE, { path: entry.path });
  }

  function when(): string {
    const { format, clock } = session;
    if (!entry.end) return entry.allDay ? format.date(clock.localDate(entry.start)) : format.dateTime(entry.start);
    if (entry.allDay) {
      const first = clock.localDate(entry.start);
      const last = clock.localDate(new Date(Date.parse(entry.end) - 1));
      return first === last ? format.date(first) : `${format.date(first)} – ${format.date(last)}`;
    }
    return format.range(entry.start, entry.end, clock.localDate(entry.start) === clock.localDate(entry.end));
  }
</script>

<button
  class="chip"
  class:inactive={entry.inactive}
  class:fill
  class:before
  class:after
  class:inert={!entry.window && !entry.path}
  draggable="true"
  ondragstart={(e) => (drag?.start(entry, e), entry.window && RecordDrag.set(e, { ...entry.window, title: entry.title }))}
  style:--chip-bg="var(--color-tag-{entry.hue}-bg)"
  style:--chip-text="var(--color-tag-{entry.hue}-text)"
  aria-label="{entry.label}: {entry.title}"
  {@attach tooltip(hint)}
  {@attach menu(() => (entry.window ? windowMenu(bus, windows, router, entry.window.kind, entry.window.id) : []))}
  onclick={(e) => (e.stopPropagation(), open())}
>
  {#if time}<span class="time">{time}</span>{/if}
  {#if handles}
    {#each edges as edge (edge)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <span
        class="handle {resize} {edge}"
        aria-hidden="true"
        title={edge === 'start' ? 'Beginn ziehen' : 'Ende ziehen'}
        onmousedown={(e) => e.stopPropagation()}
        ondragstart={(e) => e.preventDefault()}
        onclick={(e) => e.stopPropagation()}
        onpointerdown={(e) => resizer!.begin(e, entry, edge, resize!)}
      ></span>
    {/each}
  {/if}
  <span class="title">{entry.title}</span>
</button>

<style>
  .chip {
    display: flex;
    align-items: baseline;
    gap: var(--space-xs);
    width: 100%;
    min-width: 0;
    padding: 1px 6px;
    border: 0;
    border-radius: var(--radius-sm);
    background: var(--chip-bg);
    color: var(--color-text);
    font-size: var(--font-size-small);
    line-height: 1.5;
    text-align: left;
    cursor: pointer;
  }
  .chip {
    position: relative;
  }
  /* Nothing to open (absences): no pointer, hover stays plain. */
  .chip.inert {
    cursor: default;
  }
  .handle {
    position: absolute;
    z-index: 1;
    opacity: 0;
    touch-action: none;
    transition: opacity var(--motion-fast);
  }
  .chip:hover .handle {
    opacity: 1;
  }
  .handle::after {
    content: '';
    position: absolute;
    border-radius: 2px;
    background: var(--chip-text);
  }
  .handle.days {
    top: 0;
    bottom: 0;
    width: 8px;
    cursor: ew-resize;
  }
  .handle.days.start {
    left: 0;
  }
  .handle.days.end {
    right: 0;
  }
  .handle.days::after {
    top: 25%;
    bottom: 25%;
    left: 3px;
    width: 2px;
  }
  .handle.time {
    right: 0;
    left: 0;
    height: 8px;
    cursor: ns-resize;
  }
  .handle.time.start {
    top: 0;
  }
  .handle.time.end {
    bottom: 0;
  }
  .handle.time::after {
    right: 35%;
    left: 35%;
    top: 3px;
    height: 2px;
  }
  .before {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
  .after {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }
  .chip:hover {
    filter: brightness(0.96);
  }
  .fill {
    flex-direction: column;
    gap: 0;
    height: 100%;
    overflow: hidden;
  }
  .time {
    flex-shrink: 0;
    color: var(--chip-text);
    font-variant-numeric: tabular-nums;
  }
  .title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .fill .title {
    white-space: normal;
  }
  .inactive .title {
    color: var(--color-text-muted);
    text-decoration: line-through;
  }
</style>
