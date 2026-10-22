<script lang="ts">
  import Icon from '../../ui/Icon.svelte';
  import { settings } from '../../settings';
  import { bus, session } from '../../lib/container';
  import { WINDOW_OPEN } from '../../channels';
  import type { CalendarModel } from './CalendarModel.svelte';
  import type { CalendarDrag } from './CalendarDrag';
  import type { CalendarResize } from './CalendarResize';
  import { menu } from '../../ui/contextMenu';
  import { tooltip } from '../../ui/tooltip';
  import EntryChip from './EntryChip.svelte';
  import { appointmentPolicy as policy } from './services';

  /** Six-week month grid starting Monday; empty space in a day creates an appointment there (managers, coaches). */
  let hoverDay = $state<string | null>(null);
  let { model, drag, resizer }: {
    model: CalendarModel;
    /** Moving entries by drag and drop (where allowed). */
    drag?: CalendarDrag;
    /** Changing their length by pulling an edge. */
    resizer?: CalendarResize;
  } = $props();

  const max = settings.calendar.maxChipsPerDay;
  const weekdays = $derived(model.days.slice(0, 7));
  const weeks = $derived(Array.from({ length: model.days.length / 7 }, (_, i) => model.days.slice(i * 7, i * 7 + 7)));

  function create(date: string) {
    if (!policy.canCreate()) return;
    const team = model.teamId ? `team=${model.teamId}&` : '';
    bus.publish(WINDOW_OPEN, { kind: 'appointment-new', id: `${team}date=${date}` });
  }

  /** Right-click on a day: new appointment there, or the week around it. */
  function dayMenu(date: string) {
    return [
      ...(policy.canCreate() ? [{ label: `Neuer Termin am ${session.format.date(date)}`, run: () => create(date), command: 'page.new' as const }] : []),
      { label: 'Woche anzeigen', run: () => void model.goTo(date, 'week'), command: 'calendar.week' as const },
    ];
  }
</script>

<div class="month" aria-label={session.format.month(model.anchor)} role="group">
  <div class="head" aria-hidden="true">
    {#each weekdays as day (day)}<div class="weekday">{session.format.weekday(day)}</div>{/each}
  </div>
  {#each weeks as week (week[0])}
  {@const bars = model.spans(week)}
  <div class="cells" style:--lanes={bars.lanes}>
    <!-- Entries across several days: one bar per week row, above the day's own entries. -->
    <div class="bars">
      {#each bars.spans as bar (bar.entry.key)}
        <div class="bar" class:before={bar.before} class:after={bar.after} style:grid-column="{bar.from + 1} / {bar.to + 2}" style:grid-row={bar.lane + 1}>
          <EntryChip entry={bar.entry} showTime={!bar.entry.allDay && !bar.before} before={bar.before} after={bar.after} {drag} resize="days" {resizer} />
        </div>
      {/each}
    </div>
    {#each week as day (day)}
      {@const entries = model.singleOn(day)}
      {@const room = Math.max(max - bars.lanes, 1)}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div class="cell" data-day={day} class:outside={!model.inAnchorMonth(day)} class:today={day === model.today} class:creatable={policy.canCreate()}
        role="group" aria-label={session.format.dayHeading(day)} ondblclick={() => create(day)} {@attach menu(() => dayMenu(day))}
        class:drop-target={hoverDay === day}
        ondragover={(e) => drag?.over(e) && (hoverDay = day)}
        ondragleave={() => hoverDay === day && (hoverDay = null)}
        ondrop={(e) => ((hoverDay = null), drag?.drop(e, model.entries.value ?? [], (entry) => drag.toDay(entry, day), () => void model.load()))}>
        <div class="day-head">
          <span class="number">{Number(day.slice(8))}</span>
          {#if policy.canCreate()}
            <button class="add" onclick={() => create(day)} aria-label="Termin am {session.format.dayHeading(day)} anlegen"
              {@attach tooltip(`Termin am ${session.format.date(day)} anlegen`)}><Icon name="add" small /></button>
          {/if}
        </div>
        <div class="entries">
          {#each entries.slice(0, room) as entry (entry.key)}
            <EntryChip {entry} showTime={!entry.allDay} {drag} resize="days" {resizer} />
          {/each}
          {#if entries.length > room}
            <button class="more" onclick={() => model.goTo(day, 'week')} {@attach tooltip('Alle Einträge dieser Woche anzeigen')}>+{entries.length - room} weitere</button>
          {/if}
        </div>
      </div>
    {/each}
  </div>
  {/each}
</div>

<style>
  .cell.drop-target {
    background: var(--color-accent-soft);
    box-shadow: inset 0 0 0 1px var(--color-accent);
  }
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
  .cells {
    --bar-height: 22px;
    position: relative;
    border-bottom: 1px solid var(--color-border);
  }
  .cells:last-child {
    border-bottom: 0;
  }
  .bars {
    position: absolute;
    top: calc(var(--space-xs) + 26px);
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
    padding: 0 var(--space-xs);
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
  }
  .cell:last-child {
    border-right: 0;
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
    background: var(--color-accent);
    color: var(--color-on-accent);
    font-weight: var(--font-weight-bold);
  }
  .add {
    order: 1;
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border: 0;
    border-radius: var(--radius-md);
    background: none;
    color: var(--color-text-muted);
    cursor: pointer;
    opacity: 0;
    transform: scale(0.8);
    transition:
      opacity var(--motion-fast),
      transform var(--motion-base) var(--motion-easing),
      background var(--motion-fast),
      color var(--motion-fast);
  }
  .cell:hover .add,
  .add:focus-visible {
    opacity: 1;
    transform: none;
  }
  .add:hover {
    background: var(--color-accent-soft);
    color: var(--color-accent);
  }
  .entries {
    display: grid;
    gap: 2px;
    min-width: 0;
    padding-top: calc(var(--lanes) * var(--bar-height));
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
