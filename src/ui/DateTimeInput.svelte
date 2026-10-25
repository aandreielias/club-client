<script lang="ts">
  import { untrack } from 'svelte';
  import { DateText } from '../lib/time/DateText';
  import type { LocalDateTime } from '../lib/time/ZonedClock';
  import DateInput from './DateInput.svelte';

  /**
   * Date (TT.MM.JJJJ, with the calendar) and 24-hour time (HH:MM) side by side. `value` has the shape of a native
   * datetime-local input ('YYYY-MM-DDTHH:mm'), '' while either part is empty or unreadable.
   */
  let {
    value = $bindable(''),
    min,
    required = false,
    disabled = false,
    inline = false,
    autofocus = false,
    'aria-label': ariaLabel,
  }: {
    value: LocalDateTime | '';
    min?: LocalDateTime;
    required?: boolean;
    disabled?: boolean;
    inline?: boolean;
    autofocus?: boolean;
    'aria-label'?: string;
  } = $props();

  let date = $state(untrack(() => (value ?? '').slice(0, 10)));
  let time = $state(untrack(() => (value ?? '').slice(11, 16)));
  let timeInput: HTMLInputElement | undefined = $state();

  const combined = $derived.by(() => {
    const t = DateText.parseTime(time);
    return date && t ? `${date}T${t}` : '';
  });

  // Outside changes (start moved the end) rewrite both parts; a half-typed entry stays while the value is unchanged.
  $effect(() => {
    const next = value ?? '';
    untrack(() => {
      if (next === combined) return;
      date = next.slice(0, 10);
      time = next.slice(11, 16);
    });
  });

  $effect(() => {
    const next = combined;
    untrack(() => {
      if (next !== (value ?? '')) value = next;
    });
  });

  const timeProblem = $derived.by(() => {
    if (!time.trim()) return required || date ? 'Bitte eine Uhrzeit angeben (HH:MM).' : '';
    const t = DateText.parseTime(time);
    if (!t) return 'Uhrzeit als HH:MM angeben.';
    if (min && date === min.slice(0, 10) && t < min.slice(11, 16)) return `Frühestens um ${min.slice(11, 16)}.`;
    return '';
  });
  $effect(() => timeInput?.setCustomValidity(timeProblem));

  function timeBlurred() {
    const t = DateText.parseTime(time);
    if (t) time = t;
  }
</script>

<span class="datetime" class:inline role="group" aria-label={ariaLabel}>
  <DateInput bind:value={date} min={min?.slice(0, 10)} {required} {disabled} {autofocus} aria-label={ariaLabel ? `${ariaLabel}: Datum` : 'Datum'} />
  <input
    bind:this={timeInput}
    bind:value={time}
    class="time"
    type="text"
    inputmode="numeric"
    autocomplete="off"
    placeholder="HH:MM"
    maxlength="5"
    {required}
    {disabled}
    aria-label={ariaLabel ? `${ariaLabel}: Uhrzeit` : 'Uhrzeit'}
    onblur={timeBlurred}
  />
</span>

<style>
  .datetime {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 5.5rem;
    gap: var(--space-xs);
    min-width: 0;
  }
  .datetime.inline {
    display: inline-grid;
    grid-template-columns: 10.5rem 5.5rem;
  }
  .time {
    font-variant-numeric: tabular-nums;
  }
</style>
