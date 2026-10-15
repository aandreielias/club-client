<script lang="ts">
  import { session, windows } from '../../lib/container';
  import type { CalendarEntry } from '../../lib/calendar/CalendarSources';

  /** One calendar entry as a compact, clickable chip in the entry's hue. */
  let { entry, showTime = true, fill = false }: { entry: CalendarEntry; showTime?: boolean; fill?: boolean } = $props();

  const time = $derived(showTime ? session.format.time(entry.start) : '');
</script>

<button
  class="chip"
  class:inactive={entry.inactive}
  class:fill
  style:--chip-bg="var(--color-tag-{entry.hue}-bg)"
  style:--chip-text="var(--color-tag-{entry.hue}-text)"
  title="{entry.label}: {entry.title}"
  onclick={(e) => (e.stopPropagation(), windows.open(entry.window.kind, entry.window.id))}
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
