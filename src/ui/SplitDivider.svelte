<script lang="ts">
  import { split } from '../lib/container';

  /** The handle between the panes: drag it, or focus it and use the arrow keys. */
  let element: HTMLElement;

  function start(event: PointerEvent) {
    const container = element.parentElement;
    if (!container) return;
    event.preventDefault();
    element.setPointerCapture(event.pointerId);
    const box = container.getBoundingClientRect();
    const move = (e: PointerEvent) => split.setRatio((e.clientX - box.left) / box.width);
    // pointercancel / lostpointercapture: the drag ends without pointerup (touch scroll, alert, lost focus).
    const end = () => {
      element.removeEventListener('pointermove', move);
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) element.removeEventListener(type, end);
    };
    element.addEventListener('pointermove', move);
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) element.addEventListener(type, end);
  }

  function key(event: KeyboardEvent) {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      split.nudge(event.key === 'ArrowLeft' ? -1 : 1);
    }
  }
</script>

<!-- ARIA window splitter: a focusable separator with a value is interactive. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  class="divider"
  bind:this={element}
  role="separator"
  aria-orientation="vertical"
  aria-label="Breite der Seiten ändern"
  aria-valuemin="0"
  aria-valuemax="100"
  aria-valuenow={Math.round(split.ratio * 100)}
  tabindex="0"
  onpointerdown={start}
  onkeydown={key}
></div>

<style>
  .divider {
    position: relative;
    flex: none;
    width: 1px;
    background: var(--color-border);
    cursor: col-resize;
    touch-action: none;
  }
  /* A wider, invisible grip around the line. */
  .divider::before {
    position: absolute;
    inset: 0 calc(-1 * var(--space-xs));
    content: '';
  }
  .divider:hover,
  .divider:focus-visible {
    background: var(--color-accent);
    outline: none;
  }
</style>
