<script lang="ts">
  import { ACTION_KIND_LABELS, SYSTEM_STEP_LABELS, type MeetingStep } from './model';
  import { nudge, shortLabel, toFraction, toHours } from './timeline';
  import { tooltip } from '../../ui/tooltip';

  /**
   * The steps of a meeting type on one bar: the meeting in the middle, the invitation deadline and everything before it on the left,
   * what follows the end on the right. Markers drag along a logarithmic axis (hours near the meeting, weeks at the edge) and move with
   * the arrow keys (Shift: a week); clicking one selects it for editing.
   */
  let {
    noticeHours,
    steps,
    selected = null,
    onnotice,
    onmove,
    onselect,
  }: {
    noticeHours: number;
    steps: readonly MeetingStep[];
    /** Index of the selected step. */
    selected?: number | null;
    onnotice: (hours: number) => void;
    onmove: (index: number, offsetHours: number) => void;
    onselect: (index: number) => void;
  } = $props();

  /** Share of the width each side takes; the meeting block sits between. */
  const SIDE = 0.42;
  const TICKS = [
    { hours: 1, label: '1 Std.' },
    { hours: 24, label: '1 Tag' },
    { hours: 168, label: '1 Woche' },
    { hours: 672, label: '4 Wochen' },
  ];

  let bar: HTMLDivElement;

  /** Hours before the start (negative side) or after the end of a step. */
  function distance(step: MeetingStep): number {
    return step.anchor === 'BEFORE_INVITE' ? noticeHours + step.offsetHours : step.offsetHours;
  }

  const after = (step: MeetingStep) => step.anchor === 'AFTER_END';

  /** Left edge in percent. */
  function left(hours: number, isAfter: boolean): number {
    const f = toFraction(hours);
    return 100 * (isAfter ? 1 - SIDE + SIDE * f : SIDE * (1 - f));
  }

  /** Hours for a pointer position on one side. */
  function hoursAt(clientX: number, isAfter: boolean): number {
    const rect = bar.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    return toHours(isAfter ? (x - (1 - SIDE)) / SIDE : 1 - x / SIDE);
  }

  /** Moves a step to `hours` from the meeting; one anchored at the invitation keeps at least the notice period. */
  function place(index: number, hours: number) {
    const step = steps[index];
    onmove(index, step.anchor === 'BEFORE_INVITE' ? Math.max(0, hours - noticeHours) : hours);
  }

  function drag(event: PointerEvent, isAfter: boolean, apply: (hours: number) => void) {
    if (event.button !== 0) return;
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    target.focus();
    const move = (e: PointerEvent) => apply(hoursAt(e.clientX, isAfter));
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  }

  /** Arrow keys move away from the meeting or towards it, whichever side the marker is on. */
  function key(event: KeyboardEvent, hours: number, isAfter: boolean, apply: (hours: number) => void) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const outward = (event.key === 'ArrowRight') === isAfter;
    apply(nudge(hours, outward ? 1 : -1, event.shiftKey));
  }

  function name(step: MeetingStep): string {
    return step.system ? SYSTEM_STEP_LABELS[step.system] : (step.title ?? '');
  }
</script>

<div class="timeline" bind:this={bar}>
  <div class="axis"></div>
  <div class="meeting" style:left="{SIDE * 100}%" style:right="{SIDE * 100}%">Sitzung</div>
  {#each TICKS as tick (tick.hours)}
    <span class="tick" style:left="{left(tick.hours, false)}%">{tick.label}</span>
    <span class="tick" style:left="{left(tick.hours, true)}%">{tick.label}</span>
  {/each}

  <button type="button" class="marker invite" style:left="{left(noticeHours, false)}%" role="slider" aria-label="Einladungsfrist"
    aria-valuemin={0} aria-valuemax={8760} aria-valuenow={noticeHours} aria-valuetext="{shortLabel(noticeHours)} vor Beginn"
    onpointerdown={(e) => drag(e, false, onnotice)} onkeydown={(e) => key(e, noticeHours, false, onnotice)}
    {@attach tooltip('Einladungsfrist: ziehen oder mit den Pfeiltasten ändern')}>
    <span class="dot"></span>
    <span class="label">Einladen bis<br /><span class="muted">{shortLabel(noticeHours)}</span></span>
  </button>

  {#each steps as step, i (step.id ?? i)}
    {@const hours = distance(step)}
    <button type="button" class="marker" class:task={step.action === 'TASK'} class:selected={selected === i} class:low={i % 2 === 1}
      style:left="{left(hours, after(step))}%" role="slider" aria-label="{ACTION_KIND_LABELS[step.action]}: {name(step)}"
      aria-valuemin={0} aria-valuemax={8760} aria-valuenow={step.offsetHours}
      aria-valuetext="{shortLabel(hours)} {after(step) ? 'nach dem Ende' : 'vor Beginn'}"
      onclick={() => onselect(i)}
      onpointerdown={(e) => (onselect(i), drag(e, after(step), (h) => place(i, h)))}
      onkeydown={(e) => key(e, hours, after(step), (h) => place(i, h))}
      {@attach tooltip(`${name(step)}: auswählen, ziehen oder mit den Pfeiltasten verschieben`)}>
      <span class="dot"></span>
      <span class="label">{name(step)}<br /><span class="muted">{shortLabel(hours)}</span></span>
    </button>
  {/each}
</div>

<style>
  .timeline {
    position: relative;
    height: 132px;
    margin: var(--space-sm) var(--space-xl) var(--space-lg);
    touch-action: none;
    user-select: none;
  }
  .axis {
    position: absolute;
    top: 40px;
    right: 0;
    left: 0;
    height: 2px;
    background: var(--color-border-strong);
  }
  .meeting {
    position: absolute;
    top: 28px;
    height: 26px;
    display: grid;
    place-items: center;
    border-radius: var(--radius-md);
    background: var(--color-accent);
    color: var(--color-on-accent);
    font-size: var(--font-size-small);
    font-weight: var(--font-weight-medium);
  }
  .tick {
    position: absolute;
    top: 8px;
    transform: translateX(-50%);
    color: var(--color-text-faint);
    font-size: 11px;
    white-space: nowrap;
  }
  .marker {
    position: absolute;
    top: 32px;
    display: grid;
    justify-items: center;
    gap: 4px;
    width: 0;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    cursor: grab;
  }
  .marker:active {
    cursor: grabbing;
  }
  .marker:focus-visible {
    outline: none;
  }
  .dot {
    width: 16px;
    height: 16px;
    border: 2px solid var(--color-accent);
    border-radius: var(--radius-full);
    background: var(--color-elevated);
  }
  .task .dot {
    border-radius: var(--radius-sm);
  }
  .invite .dot {
    border-color: var(--color-warning);
    transform: rotate(45deg);
    border-radius: 2px;
  }
  .selected .dot,
  .marker:focus-visible .dot {
    background: var(--color-accent);
    box-shadow: 0 0 0 4px var(--color-accent-soft);
  }
  .invite:focus-visible .dot {
    background: var(--color-warning);
  }
  .label {
    max-width: 9rem;
    overflow: hidden;
    font-size: 11.5px;
    line-height: 1.25;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .low .label {
    margin-top: 30px;
  }
  .invite .label {
    color: var(--color-warning);
  }
</style>
