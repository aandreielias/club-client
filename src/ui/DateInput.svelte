<script lang="ts" module>
  const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  let nextId = 0;
</script>

<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { session } from '../lib/container';
  import { AnchoredList } from '../lib/overlay/AnchoredList.svelte';
  import { DateText } from '../lib/time/DateText';
  import { ZonedClock, type LocalDate } from '../lib/time/ZonedClock';
  import Icon from './Icon.svelte';
  import { tooltip } from './tooltip';

  /**
   * The one date field of the app: typed as TT.MM.JJJJ, or picked in the house-style calendar below it.
   * `value` stays ISO ('YYYY-MM-DD', '' when empty or unreadable), like a native date input; an unreadable
   * or out-of-range entry blocks the form with a German validity message.
   * Calendar keys: arrows move by day/week, PageUp/PageDown by month (with Shift by year), Home/End to the
   * week's ends, Enter/Space pick, Escape closes.
   */
  let {
    value = $bindable(''),
    min,
    max,
    required = false,
    disabled = false,
    inline = false,
    autofocus = false,
    id,
    onchange,
    'aria-label': ariaLabel,
  }: {
    value: LocalDate | '';
    min?: LocalDate;
    max?: LocalDate;
    required?: boolean;
    disabled?: boolean;
    /** As wide as the date, not the whole row. */
    inline?: boolean;
    autofocus?: boolean;
    id?: string;
    /** Called after the user picked or typed another valid date. */
    onchange?: (value: LocalDate | '') => void;
    'aria-label'?: string;
  } = $props();

  const panelId = `date-panel-${nextId++}`;
  let wrapper: HTMLElement | undefined = $state();
  let input: HTMLInputElement | undefined = $state();
  let panel: HTMLElement | undefined = $state();
  let text = $state(untrack(() => DateText.format(value ?? '')));
  /** The focused day in the calendar; its month is shown. */
  let active = $state('');
  let years = $state(false);
  const popover = new AnchoredList(() => wrapper, () => panel, () => hide(false), 'own');

  const today = $derived(session.clock.today());
  const grid = $derived(active ? DateText.monthGrid(active) : []);
  const yearPage = $derived(active ? Math.floor(Number(active.slice(0, 4)) / 12) * 12 : 0);

  // Outside changes (form reset, start moved the end) rewrite the text; typing that already says the same date stays.
  $effect(() => {
    const next = value ?? '';
    untrack(() => {
      if ((DateText.parse(text) ?? '') !== next) text = DateText.format(next);
    });
  });

  const problem = $derived.by(() => {
    if (!text.trim()) return required ? 'Bitte ein Datum angeben (TT.MM.JJJJ).' : '';
    const date = DateText.parse(text);
    if (!date) return 'Datum als TT.MM.JJJJ angeben.';
    if (min && date < min) return `Frühestens am ${DateText.format(min)}.`;
    if (max && date > max) return `Spätestens am ${DateText.format(max)}.`;
    return '';
  });
  $effect(() => input?.setCustomValidity(problem));

  const allowed = (day: LocalDate): boolean => (!min || day >= min) && (!max || day <= max);

  function typed() {
    const next = DateText.parse(text) ?? '';
    if (next === value) return;
    value = next;
    if (next) onchange?.(next);
  }

  function blurred() {
    if (DateText.parse(text)) text = DateText.format(value);
  }

  async function show() {
    if (disabled || popover.open) return;
    const start = DateText.parse(text) ?? today;
    active = min && start < min ? min : max && start > max ? max : start;
    years = false;
    if (!popover.show()) return;
    await tick();
    popover.place();
    focusActive();
  }

  function hide(focusInput = true) {
    if (popover.hide() && focusInput) input?.focus();
  }

  function focusActive() {
    void tick().then(() => panel?.querySelector<HTMLElement>('[data-active="true"]')?.focus());
  }

  function choose(day: LocalDate) {
    if (!allowed(day)) return;
    const changed = day !== value;
    value = day;
    text = DateText.format(day);
    hide();
    if (!changed) return;
    onchange?.(day);
    // Like a native input: lets surrounding forms notice the edit (unsaved-changes check).
    input?.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function clear() {
    value = '';
    text = '';
    hide();
    onchange?.('');
    input?.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function move(next: LocalDate) {
    active = next;
    focusActive();
  }

  function pickYear(year: number) {
    active = DateText.addMonths(active, (year - Number(active.slice(0, 4))) * 12);
    years = false;
    focusActive();
  }

  function inputKey(event: KeyboardEvent) {
    if (event.key === 'ArrowDown' && event.altKey) {
      event.preventDefault();
      void show();
    }
  }

  function gridKey(event: KeyboardEvent) {
    const weekday = (new Date(`${active}T00:00:00Z`).getUTCDay() + 6) % 7;
    const months = event.shiftKey ? 12 : 1;
    const keys: Record<string, () => void> = {
      ArrowLeft: () => move(ZonedClock.addDays(active, -1)),
      ArrowRight: () => move(ZonedClock.addDays(active, 1)),
      ArrowUp: () => move(ZonedClock.addDays(active, -7)),
      ArrowDown: () => move(ZonedClock.addDays(active, 7)),
      Home: () => move(ZonedClock.addDays(active, -weekday)),
      End: () => move(ZonedClock.addDays(active, 6 - weekday)),
      PageUp: () => move(DateText.addMonths(active, -months)),
      PageDown: () => move(DateText.addMonths(active, months)),
      Enter: () => choose(active),
      ' ': () => choose(active),
    };
    const action = keys[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  }

  function panelKey(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      // Escape must not also close the surrounding window or dialog.
      event.preventDefault();
      event.stopPropagation();
      if (years) {
        years = false;
        focusActive();
      } else hide();
    } else if (event.key === 'Tab') {
      // Like the Select list: Tab closes, focus continues from the field.
      hide();
    }
  }
</script>

<span class="date" class:inline bind:this={wrapper}>
  <!-- svelte-ignore a11y_autofocus -->
  <input
    bind:this={input}
    bind:value={text}
    type="text"
    inputmode="numeric"
    autocomplete="off"
    placeholder="TT.MM.JJJJ"
    maxlength="10"
    {id}
    {required}
    {disabled}
    {autofocus}
    aria-label={ariaLabel}
    oninput={typed}
    onblur={blurred}
    onkeydown={inputKey}
  />
  <button type="button" class="open" {disabled} aria-label="Kalender öffnen" aria-haspopup="dialog" aria-expanded={popover.open} aria-controls={panelId} {@attach tooltip('Kalender öffnen (Alt+↓)')} onclick={() => (popover.open ? hide() : void show())}>
    <Icon name="calendar" small />
  </button>
</span>

<div bind:this={panel} id={panelId} class="panel" popover="manual" role="dialog" aria-label="Datum wählen" tabindex="-1" onkeydown={panelKey}>
  {#if popover.open && active}
    <div class="head">
      <button type="button" class="nav" aria-label={years ? 'Frühere Jahre' : 'Voriger Monat'} {@attach tooltip(() => (years ? 'Frühere Jahre' : 'Voriger Monat (Bild ↑)'))} onclick={() => (years ? (active = DateText.addMonths(active, -144)) : move(DateText.addMonths(active, -1)))}>
        <Icon name="back" small />
      </button>
      <button type="button" class="title" aria-label={years ? 'Zurück zu den Tagen' : 'Jahr wählen'} {@attach tooltip(() => (years ? 'Zurück zu den Tagen' : 'Jahr wählen'))} onclick={() => (years ? ((years = false), focusActive()) : (years = true))}>
        {years ? `${yearPage} – ${yearPage + 11}` : session.format.month(active)}
      </button>
      <button type="button" class="nav" aria-label={years ? 'Spätere Jahre' : 'Nächster Monat'} {@attach tooltip(() => (years ? 'Spätere Jahre' : 'Nächster Monat (Bild ↓)'))} onclick={() => (years ? (active = DateText.addMonths(active, 144)) : move(DateText.addMonths(active, 1)))}>
        <Icon name="next" small />
      </button>
    </div>

    {#if years}
      <div class="years">
        {#each Array.from({ length: 12 }, (_, i) => yearPage + i) as year (year)}
          {@const outside = (!!min && `${year}-12-31` < min) || (!!max && `${year}-01-01` > max)}
          <button type="button" class="year" class:current={`${year}` === active.slice(0, 4)} disabled={outside} {@attach tooltip(`Jahr ${year}`)} onclick={() => pickYear(year)}>{year}</button>
        {/each}
      </div>
    {:else}
      <div class="grid" role="grid" tabindex="-1" onkeydown={gridKey}>
        {#each WEEKDAYS as day (day)}<span class="weekday" role="columnheader">{day}</span>{/each}
        {#each grid as day (day)}
          <button
            type="button"
            class="day"
            class:other={day.slice(0, 7) !== active.slice(0, 7)}
            class:today={day === today}
            role="gridcell"
            tabindex={day === active ? 0 : -1}
            data-active={day === active}
            aria-selected={day === value}
            aria-label={DateText.format(day)}
            disabled={!allowed(day)}
            {@attach tooltip(day === today ? 'Heute' : null)}
            onclick={() => choose(day)}
          >
            {Number(day.slice(8))}
          </button>
        {/each}
      </div>
      <div class="foot">
        <button type="button" class="link" disabled={!allowed(today)} {@attach tooltip(`Heute wählen (${DateText.format(today)})`)} onclick={() => choose(today)}>Heute</button>
        {#if value && !required}<button type="button" class="link" {@attach tooltip('Datum entfernen')} onclick={clear}>Leeren</button>{/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .date {
    position: relative;
    display: block;
    min-width: 0;
  }
  .date.inline {
    display: inline-block;
    width: 10.5rem;
  }
  .date input {
    padding-right: calc(var(--control-padding-x) + 24px);
    font-variant-numeric: tabular-nums;
  }
  .open {
    position: absolute;
    top: 50%;
    right: 4px;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-text-muted);
    transform: translateY(-50%);
    cursor: pointer;
    transition: background var(--motion-fast), color var(--motion-fast);
  }
  .open:hover:not(:disabled) {
    background: var(--color-hover);
    color: var(--color-text);
  }
  .open:disabled {
    color: var(--color-text-faint);
    cursor: not-allowed;
  }

  .panel {
    position: fixed;
    inset: auto;
    width: 17.5rem;
    margin: 0;
    padding: var(--space-sm);
    border: 0;
    border-radius: var(--radius-lg);
    background: var(--color-elevated);
    color: var(--color-text);
    box-shadow: var(--color-shadow-popover);
    outline: none;
  }
  .panel:popover-open {
    animation: pop-in var(--motion-base) var(--motion-easing);
    transform-origin: top center;
  }
  @keyframes pop-in {
    from {
      opacity: 0;
      transform: translateY(-4px) scale(0.98);
    }
  }

  button {
    font: inherit;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-xs);
    margin-bottom: var(--space-xs);
  }
  .nav,
  .title,
  .day,
  .year,
  .link {
    border: 0;
    border-radius: var(--radius-md);
    background: transparent;
    color: inherit;
    cursor: pointer;
    transition: background var(--motion-fast), color var(--motion-fast);
  }
  .nav {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    color: var(--color-text-muted);
  }
  .title {
    flex: 1;
    height: 32px;
    font-weight: var(--font-weight-medium);
  }
  .nav:hover,
  .title:hover,
  .day:hover:not(:disabled),
  .year:hover:not(:disabled),
  .link:hover:not(:disabled) {
    background: var(--color-hover);
    color: var(--color-text);
  }
  .nav:focus-visible,
  .title:focus-visible,
  .day:focus-visible,
  .year:focus-visible,
  .link:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px var(--color-accent-soft);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
    outline: none;
  }
  .weekday {
    padding: var(--space-xs) 0;
    color: var(--color-text-faint);
    font-size: var(--font-size-small);
    text-align: center;
  }
  .day {
    height: 2.1rem;
    font-size: var(--font-size-base);
    font-variant-numeric: tabular-nums;
  }
  .day.other {
    color: var(--color-text-faint);
  }
  .day.today {
    color: var(--color-accent);
    font-weight: var(--font-weight-medium);
    box-shadow: inset 0 0 0 1px var(--color-accent);
  }
  .day[aria-selected='true'],
  .year.current {
    background: var(--color-accent);
    color: var(--color-on-accent);
    font-weight: var(--font-weight-medium);
  }
  .day[aria-selected='true']:hover,
  .year.current:hover {
    background: var(--color-accent);
    color: var(--color-on-accent);
  }
  .day:disabled,
  .year:disabled,
  .link:disabled {
    color: var(--color-text-faint);
    opacity: 0.45;
    cursor: not-allowed;
  }

  .years {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-xs);
  }
  .year {
    height: 2.5rem;
    font-variant-numeric: tabular-nums;
  }

  .foot {
    display: flex;
    justify-content: space-between;
    margin-top: var(--space-xs);
    padding-top: var(--space-xs);
    border-top: 1px solid var(--color-border);
  }
  .link {
    padding: var(--space-xs) var(--space-sm);
    color: var(--color-accent);
    font-size: var(--font-size-small);
    font-weight: var(--font-weight-medium);
  }

  @media (prefers-reduced-motion: reduce) {
    .panel:popover-open {
      animation: none;
    }
  }
</style>
