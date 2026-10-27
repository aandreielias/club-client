<script lang="ts">
  import { settings } from '../../settings';
  import { session } from '../../lib/container';
  import type { CalendarModel } from './CalendarModel.svelte';
  import type { CalendarDrag } from './CalendarDrag';
  import type { CalendarResize } from './CalendarResize';
  import { menu } from '../../ui/contextMenu';
  import EntryChip from './EntryChip.svelte';
  import { createAppointment, newAppointmentEntries } from './newAppointment';
  import SpanBars from './SpanBars.svelte';

  /** Seven days with an all-day lane (due dates) and a time grid for appointments. */
  let hover = $state<string | null>(null);

  /** Minutes after midnight at the pointer's height in a day column. */
  function minutesAt(event: DragEvent): number {
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const share = Math.min(Math.max((event.clientY - box.top) / box.height, 0), 1);
    return startHour * 60 + share * (endHour - startHour) * 60;
  }

  let { model, drag, resizer }: {
    model: CalendarModel;
    /** Moving entries by drag and drop (where allowed). */
    drag?: CalendarDrag;
    /** Changing their length: whole days in the all-day lane, the time in the grid. */
    resizer?: CalendarResize;
  } = $props();

  const { weekStartHour: startHour, weekEndHour: endHour } = settings.calendar;
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const bars = $derived(model.spans(model.days));


</script>

<div class="week" style:--hours={hours.length}>
  <div class="corner"></div>
  {#each model.days as day (day)}
    <div class="day-head" class:today={day === model.today}>
      <span class="muted">{session.format.weekday(day)}</span>
      <span class="number">{Number(day.slice(8))}</span>
    </div>
  {/each}

  <div class="lane-label muted">Ganztägig</div>
  <div class="all-day-row" style:--lanes={bars.lanes}>
  {#each model.days as day (day)}
    <div class="all-day" data-day={day} role="group" aria-label="Ganztägig {session.format.date(day)}" {@attach menu(() => newAppointmentEntries(model, day))} class:drop-target={hover === `all:${day}`}
      ondragover={(e) => drag?.over(e) && (hover = `all:${day}`)}
      ondragleave={() => hover === `all:${day}` && (hover = null)}
      ondrop={(e) => ((hover = null), drag?.drop(e, model.entries.value ?? [], (entry) => drag.toDay(entry, day), () => void model.load()))}>
      {#each model.singleOn(day).filter((e) => e.allDay) as entry (entry.key)}
        <EntryChip {entry} {drag} resize="days" {resizer} />
      {/each}
    </div>
  {/each}
    <!-- Entries across several days (also timed ones, e.g. a circular vote): one bar each. -->
    <SpanBars spans={bars.spans} top="2px" gap="2px" {drag} {resizer} />
  </div>

  <div class="hours">
    {#each hours as hour (hour)}<div class="hour muted">{String(hour).padStart(2, '0')}:00</div>{/each}
  </div>
  {#each model.days as day (day)}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="column" data-day={day} data-start-hour={startHour} data-end-hour={endHour} class:today={day === model.today} ondblclick={() => createAppointment(model, day)} {@attach menu(() => newAppointmentEntries(model, day))}
      class:drop-target={hover === day}
      ondragover={(e) => drag?.over(e) && (hover = day)}
      ondragleave={() => hover === day && (hover = null)}
      ondrop={(e) => {
        hover = null;
        const minutes = minutesAt(e);
        // Due dates (all-day) dropped on the grid keep their time; appointments take the dropped time.
        void drag?.drop(e, model.entries.value ?? [], (entry) => (entry.allDay ? drag.toDay(entry, day) : drag.toTime(entry, day, minutes)), () => void model.load());
      }}>
      {#each hours as hour (hour)}<div class="slot"></div>{/each}
      {#each model.placeOn(day, startHour, endHour) as placed (placed.entry.key)}
        <div class="event" style:top="{placed.top}%" style:height="{placed.height}%"
          style:left="{(placed.lane / placed.lanes) * 100}%" style:width="{100 / placed.lanes}%">
          <EntryChip entry={placed.entry} fill {drag} resize="time" {resizer} />
        </div>
      {/each}
    </div>
  {/each}
</div>

<style>
  .drop-target {
    background: var(--color-accent-soft);
  }
  .week {
    display: grid;
    grid-template-columns: 3.5rem repeat(7, minmax(0, 1fr));
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }
  .corner,
  .day-head,
  .lane-label {
    border-bottom: 1px solid var(--color-border);
  }
  .day-head {
    display: flex;
    justify-content: center;
    align-items: baseline;
    gap: var(--space-xs);
    padding: var(--space-xs);
    font-size: var(--font-size-small);
  }
  .day-head .number {
    display: inline-grid;
    place-items: center;
    min-width: 24px;
    height: 24px;
    border-radius: 50%;
    font-weight: var(--font-weight-medium);
  }
  .day-head.today .number {
    background: var(--color-accent);
    color: var(--color-on-accent);
  }
  .lane-label {
    padding: var(--space-xs);
    font-size: 11px;
    text-align: right;
  }
  .all-day-row {
    --bar-height: 22px;
    position: relative;
    display: grid;
    grid-column: 2 / -1;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    border-bottom: 1px solid var(--color-border);
  }
  .all-day {
    display: grid;
    align-content: start;
    gap: 2px;
    min-height: 28px;
    padding: calc(2px + var(--lanes) * var(--bar-height)) 2px 2px;
    border-left: 1px solid var(--color-border);
  }
  .hours {
    display: grid;
    grid-template-rows: repeat(var(--hours), var(--layout-calendar-hour));
  }
  .hour {
    padding: 0 var(--space-xs);
    font-size: 11px;
    text-align: right;
    transform: translateY(-0.6em);
  }
  .hour:first-child {
    transform: none;
  }
  .column {
    position: relative;
    display: grid;
    grid-template-rows: repeat(var(--hours), var(--layout-calendar-hour));
    border-left: 1px solid var(--color-border);
  }
  .column.today {
    background: var(--color-surface);
  }
  .slot {
    border-bottom: 1px solid var(--color-border);
  }
  .slot:last-child {
    border-bottom: 0;
  }
  .event {
    position: absolute;
    padding: 1px 2px;
  }
  :global([data-layout='compact']) .week {
    grid-template-columns: 2.5rem repeat(7, minmax(0, 1fr));
  }
  :global([data-layout='compact']) .day-head .muted {
    display: none;
  }
</style>
