<script lang="ts">
  import { bus, router, session, windows } from '../../lib/container';
  import { WINDOW_OPEN } from '../../channels';
  import type { CalendarEntry } from '../../lib/calendar/CalendarSources';
  import { windowMenu } from '../../lib/window/windowMenu';
  import { menu } from '../../ui/contextMenu';
  import { tooltip } from '../../ui/tooltip';
  import type { CalendarDrag } from './CalendarDrag';
  import { RecordDrag } from '../../lib/records/RecordDrag';

  /** One calendar entry as a compact, clickable chip in the entry's hue. */
  let {
    entry,
    showTime = true,
    fill = false,
    before = false,
    after = false,
    drag,
  }: {
    entry: CalendarEntry;
    showTime?: boolean;
    fill?: boolean;
    /** A bar across days that started before / goes on after the shown week: its edge stays open. */
    before?: boolean;
    after?: boolean;
    drag?: CalendarDrag;
  } = $props();

  const time = $derived(showTime ? session.format.time(entry.start) : '');
  const hint = $derived(
    `${entry.label}: ${entry.title}\n${when()}`,
  );
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
  draggable="true"
  ondragstart={(e) => (drag?.start(entry, e), RecordDrag.set(e, { ...entry.window, title: entry.title }))}
  style:--chip-bg="var(--color-tag-{entry.hue}-bg)"
  style:--chip-text="var(--color-tag-{entry.hue}-text)"
  aria-label="{entry.label}: {entry.title}"
  {@attach tooltip(hint)}
  {@attach menu(() => windowMenu(bus, windows, router, entry.window.kind, entry.window.id))}
  onclick={(e) => (e.stopPropagation(), bus.publish(WINDOW_OPEN, { kind: entry.window.kind, id: entry.window.id }))}
>
  {#if time}<span class="time">{time}</span>{/if}
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
    border-left: 3px solid var(--chip-text);
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
