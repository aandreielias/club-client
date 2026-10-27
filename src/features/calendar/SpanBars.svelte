<script lang="ts">
  import type { CalendarDrag } from './CalendarDrag';
  import type { Span } from './CalendarModel.svelte';
  import type { CalendarResize } from './CalendarResize';
  import EntryChip from './EntryChip.svelte';

  /** Entries across several days of one row: one bar each, in lanes above the days' own entries. */
  let { spans, top, gap, drag, resizer }: {
    spans: readonly Span[];
    /** Distance from the row's top (below the day numbers in the month). */
    top: string;
    /** Space between a bar and the day borders. */
    gap: string;
    drag?: CalendarDrag;
    resizer?: CalendarResize;
  } = $props();
</script>

<div class="bars" style:top style:--bar-gap={gap}>
  {#each spans as bar (bar.entry.key)}
    <div class="bar" class:before={bar.before} class:after={bar.after} style:grid-column="{bar.from + 1} / {bar.to + 2}" style:grid-row={bar.lane + 1}>
      <EntryChip entry={bar.entry} showTime={!bar.entry.allDay && !bar.before} before={bar.before} after={bar.after} {drag} resize="days" {resizer} />
    </div>
  {/each}
</div>

<style>
  .bars {
    position: absolute;
    right: 0;
    left: 0;
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    grid-auto-rows: calc(var(--bar-height) - 2px);
    row-gap: 2px;
    pointer-events: none;
  }
  .bar {
    min-width: 0;
    padding: 0 var(--bar-gap);
    pointer-events: auto;
  }
  .bar.before {
    padding-left: 0;
  }
  .bar.after {
    padding-right: 0;
  }
  .bar :global(.chip) {
    height: 100%;
  }
</style>
