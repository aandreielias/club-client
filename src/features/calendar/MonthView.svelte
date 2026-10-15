<script lang="ts">
  import { settings } from '../../settings';
  import { session, windows } from '../../lib/container';
  import type { CalendarModel } from './CalendarModel.svelte';
  import EntryChip from './EntryChip.svelte';
  import { appointmentPolicy as policy } from './services';

  /** Six-week month grid starting Monday; empty space in a day creates an appointment there (managers, coaches). */
  let { model }: { model: CalendarModel } = $props();

  const max = settings.calendar.maxChipsPerDay;
  const weekdays = $derived(model.days.slice(0, 7));

  function create(date: string) {
    if (!policy.canCreate()) return;
    const team = model.teamId ? `team=${model.teamId}&` : '';
    windows.open('appointment-new', `${team}date=${date}`);
  }
</script>

<div class="month" aria-label={session.format.month(model.anchor)} role="group">
  <div class="head" aria-hidden="true">
    {#each weekdays as day (day)}<div class="weekday">{session.format.weekday(day)}</div>{/each}
  </div>
  <div class="cells">
    {#each model.days as day (day)}
      {@const entries = model.entriesOn(day)}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div class="cell" class:outside={!model.inAnchorMonth(day)} class:today={day === model.today} class:creatable={policy.canCreate()}
        role="group" aria-label={session.format.dayHeading(day)} ondblclick={() => create(day)}>
        <div class="day-head">
          <span class="number">{Number(day.slice(8))}</span>
          {#if policy.canCreate()}
            <button class="add" onclick={() => create(day)} aria-label="Termin am {session.format.dayHeading(day)} anlegen">Neu</button>
          {/if}
        </div>
        <div class="entries">
          {#each entries.slice(0, max) as entry (entry.key)}
            <EntryChip {entry} showTime={!entry.allDay} />
          {/each}
          {#if entries.length > max}
            <button class="more" onclick={() => model.goTo(day, 'week')}>+{entries.length - max} weitere</button>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .month {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }
  .head,
  .cells {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
  }
  .weekday {
    padding: var(--space-xs) var(--space-sm);
    border-bottom: 1px solid var(--color-border);
    color: var(--color-text-muted);
    font-size: var(--font-size-small);
    text-align: right;
  }
  .cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    min-height: 7.5rem;
    padding: var(--space-xs);
    border-right: 1px solid var(--color-border);
    border-bottom: 1px solid var(--color-border);
  }
  .cell:nth-child(7n) {
    border-right: 0;
  }
  .cell:nth-last-child(-n + 7) {
    border-bottom: 0;
  }
  .outside {
    background: var(--color-surface);
  }
  .outside .number {
    color: var(--color-text-faint);
  }
  .day-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: 24px;
  }
  .number {
    display: inline-grid;
    place-items: center;
    min-width: 24px;
    height: 24px;
    margin-left: auto;
    order: 2;
    border-radius: 50%;
    font-size: var(--font-size-small);
    font-variant-numeric: tabular-nums;
  }
  .today .number {
    background: var(--color-danger);
    color: var(--color-on-accent);
    font-weight: var(--font-weight-bold);
  }
  .add {
    order: 1;
    visibility: hidden;
    padding: 0 var(--space-xs);
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--color-text-muted);
    font-size: var(--font-size-small);
    cursor: pointer;
  }
  .cell:hover .add,
  .add:focus-visible {
    visibility: visible;
  }
  .add:hover {
    background: var(--color-hover);
  }
  .entries {
    display: grid;
    gap: 2px;
    min-width: 0;
  }
  .more {
    padding: 0 6px;
    border: 0;
    background: none;
    color: var(--color-text-muted);
    font-size: var(--font-size-small);
    text-align: left;
    cursor: pointer;
  }
  .more:hover {
    color: var(--color-text);
  }
  :global([data-layout='compact']) .cell {
    min-height: 4.5rem;
    padding: 2px;
  }
  :global([data-layout='compact']) .entries :global(.time) {
    display: none;
  }
</style>
