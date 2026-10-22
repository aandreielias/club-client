<script lang="ts" module>
  export interface SortableItem {
    key: string;
    label: string;
  }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * A list reordered by drag and drop (mouse and touch, via pointer events). Keyboard: Space picks
   * an entry up, arrow keys move it, Space drops it, Escape cancels. `extra` adds content at the
   * end of each row (e.g. a checkbox).
   */
  let {
    items: entries,
    onreorder: save,
    label,
    extra,
  }: { items: readonly SortableItem[]; onreorder: (keys: string[]) => void; label: string; extra?: Snippet<[SortableItem]> } = $props();

  interface Drag {
    key: string;
    from: number;
    startY: number;
    offset: number;
    /** Vertical centres of all rows at drag start. */
    centres: number[];
    rowHeight: number;
  }

  let drag = $state<Drag | null>(null);
  let grabbed = $state<{ key: string; original: string[] } | null>(null);
  let announcement = $state('');
  let rows: HTMLDivElement[] = $state([]);

  /** Index the dragged entry would land on for the current pointer position. */
  const target = $derived.by(() => {
    if (!drag) return -1;
    const centre = drag.centres[drag.from] + drag.offset;
    let index = 0;
    drag.centres.forEach((c, i) => {
      if (i !== drag!.from && c < centre) index++;
    });
    return index;
  });

  function moved(paths: string[], from: number, to: number): string[] {
    const next = [...paths];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  }

  function pointerdown(event: PointerEvent, entry: SortableItem, index: number) {
    if (event.button !== 0) return;
    const row = event.currentTarget as HTMLDivElement;
    row.setPointerCapture(event.pointerId);
    drag = {
      key: entry.key,
      from: index,
      startY: event.clientY,
      offset: 0,
      centres: rows.map((r) => {
        const box = r.getBoundingClientRect();
        return box.top + box.height / 2;
      }),
      rowHeight: row.getBoundingClientRect().height,
    };
  }

  function pointermove(event: PointerEvent) {
    if (drag) drag.offset = event.clientY - drag.startY;
  }

  function pointerup() {
    if (!drag) return;
    const { from, key } = drag;
    const to = target;
    drag = null;
    if (to >= 0 && to !== from) {
      save(moved(entries.map((e) => e.key), from, to));
      announce(key, to);
    }
  }

  /** How far a row shifts to make room for the dragged one. */
  function shift(index: number): number {
    if (!drag || index === drag.from || target < 0) return 0;
    if (drag.from < index && index <= target) return -drag.rowHeight;
    if (target <= index && index < drag.from) return drag.rowHeight;
    return 0;
  }

  function keydown(event: KeyboardEvent, entry: SortableItem, index: number) {
    const paths = entries.map((e) => e.key);
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (grabbed) {
        grabbed = null;
        announcement = `${entry.label} abgelegt an Position ${index + 1}.`;
      } else {
        grabbed = { key: entry.key, original: paths };
        announcement = `${entry.label} aufgenommen. Mit den Pfeiltasten verschieben, mit Leertaste ablegen.`;
      }
    } else if (grabbed && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      const to = index + (event.key === 'ArrowUp' ? -1 : 1);
      if (to < 0 || to >= paths.length) return;
      save(moved(paths, index, to));
      announce(entry.key, to);
      queueMicrotask(() => rows[to]?.focus());
    } else if (grabbed && event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      save(grabbed.original);
      grabbed = null;
      announcement = 'Verschieben abgebrochen.';
    }
  }

  function announce(key: string, to: number) {
    const name = entries.find((e) => e.key === key)?.label ?? '';
    announcement = `${name} jetzt an Position ${to + 1} von ${entries.length}.`;
  }
</script>

<ol class="entries" aria-label={label}>
  {#each entries as entry, index (entry.key)}
    <li><div
      class="row-item"
      bind:this={rows[index]}
      tabindex="0"
      role="button"
      aria-pressed={grabbed?.key === entry.key}
      aria-roledescription="verschiebbarer Eintrag"
      aria-label="{entry.label}, Position {index + 1} von {entries.length}"
      class:dragging={drag?.key === entry.key}
      class:grabbed={grabbed?.key === entry.key}
      style:transform={drag?.key === entry.key ? `translateY(${drag.offset}px)` : shift(index) ? `translateY(${shift(index)}px)` : undefined}
      onpointerdown={(e) => pointerdown(e, entry, index)}
      onpointermove={pointermove}
      onpointerup={pointerup}
      onpointercancel={() => (drag = null)}
      onkeydown={(e) => keydown(e, entry, index)}
    >
      <span class="grip" aria-hidden="true"></span>
      <span class="label">{entry.label}</span>
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <span class="extra" onpointerdown={(e) => e.stopPropagation()}>{@render extra?.(entry)}</span>
      <span class="position muted">{index + 1}</span>
    </div></li>
  {/each}
</ol>
<p class="visually-hidden" aria-live="assertive">{announcement}</p>

<style>
  .entries {
    display: grid;
    max-width: var(--layout-readable-width);
    margin: 0;
    padding: 0;
    list-style: none;
    border-top: 1px solid var(--color-border);
    touch-action: none;
    user-select: none;
  }
  .row-item {
    position: relative;
    display: grid;
    grid-template-columns: 12px minmax(0, 1fr) auto auto;
    align-items: center;
    gap: var(--space-md);
    min-height: 40px;
    padding: 0 var(--space-sm);
    border-bottom: 1px solid var(--color-border);
    background: var(--color-background);
    cursor: grab;
    transition: transform var(--motion-fast) var(--motion-easing);
  }
  .row-item:hover {
    background: var(--color-hover);
  }
  .row-item:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: -2px;
  }
  .row-item.dragging {
    z-index: 1;
    border-radius: var(--radius-md);
    box-shadow: var(--color-shadow-popover);
    cursor: grabbing;
    transition: none;
  }
  .row-item.grabbed {
    background: var(--color-selected);
  }
  /* Grip: two columns of dots drawn with a gradient (no icon asset). */
  .grip {
    width: 8px;
    height: 14px;
    background: radial-gradient(circle, var(--color-text-faint) 1.2px, transparent 1.5px) 0 0 / 4px 4px;
  }
  .label {
    font-weight: var(--font-weight-medium);
  }
  .extra {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }
  .extra:empty {
    display: none;
  }
  .position {
    font-variant-numeric: tabular-nums;
  }
</style>
