<script lang="ts">
  import { settings } from '../../settings';
  import { session, windows } from '../../lib/container';
  import type { CalendarModel } from './CalendarModel.svelte';
  import EntryChip from './EntryChip.svelte';
  import { appointmentPolicy as policy } from './services';

  /** Seven days with an all-day lane (due dates) and a time grid for appointments. */
  let { model }: { model: CalendarModel } = $props();

  const { weekStartHour: startHour, weekEndHour: endHour } = settings.calendar;
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);

  function create(date: string) {
    if (!policy.canCreate()) return;
    const team = model.teamId ? `team=${model.teamId}&` : '';
    windows.open('appointment-new', `${team}date=${date}`);
  }
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
  {#each model.days as day (day)}
    <div class="all-day">
      {#each model.entriesOn(day).filter((e) => e.allDay) as entry (entry.key)}
        <EntryChip {entry} />
      {/each}
    </div>
  {/each}

  <div class="hours">
    {#each hours as hour (hour)}<div class="hour muted">{String(hour).padStart(2, '0')}:00</div>{/each}
  </div>
  {#each model.days as day (day)}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="column" class:today={day === model.today} ondblclick={() => create(day)}>
      {#each hours as hour (hour)}<div class="slot"></div>{/each}
      {#each model.placeOn(day, startHour, endHour) as placed (placed.entry.key)}
        <div class="event" style:top="{placed.top}%" style:height="{placed.height}%"
          style:left="{(placed.lane / placed.lanes) * 100}%" style:width="{100 / placed.lanes}%">
          <EntryChip entry={placed.entry} fill />
        </div>
      {/each}
    </div>
  {/each}
</div>

<style>
  .week {
    display: grid;
    grid-template-columns: 3.5rem repeat(7, minmax(0, 1fr));
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }
  .corner,
  .day-head,
  .lane-label,
  .all-day {
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
    background: var(--color-danger);
    color: var(--color-on-accent);
  }
  .lane-label {
    padding: var(--space-xs);
    font-size: 11px;
    text-align: right;
  }
  .all-day {
    display: grid;
    align-content: start;
    gap: 2px;
    min-height: 28px;
    padding: 2px;
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
