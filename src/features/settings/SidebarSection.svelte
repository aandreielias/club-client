<script lang="ts">
  import { navCatalog, preferences, session } from '../../lib/container';
  import type { NavEntry } from '../../lib/navigation/NavCatalog';
  import Button from '../../ui/Button.svelte';

  /**
   * Reorders the main sidebar entries by drag and drop (mouse and touch, via pointer events).
   * Keyboard: Space picks an entry up, arrow keys move it, Space drops it, Escape cancels.
   */
  const entries = $derived(navCatalog.ordered(preferences.values.navOrder, (...roles) => session.hasRole(...roles)));

  interface Drag {
    path: string;
    from: number;
    startY: number;
    offset: number;
    /** Vertical centres of all rows at drag start. */
    centres: number[];
    rowHeight: number;
  }

  let drag = $state<Drag | null>(null);
  let grabbed = $state<{ path: string; original: string[] } | null>(null);
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

  function save(paths: string[]) {
    preferences.set('navOrder', paths);
  }

  function moved(paths: string[], from: number, to: number): string[] {
    const next = [...paths];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  }

  function pointerdown(event: PointerEvent, entry: NavEntry, index: number) {
    if (event.button !== 0) return;
    const row = event.currentTarget as HTMLDivElement;
    row.setPointerCapture(event.pointerId);
    drag = {
      path: entry.path,
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
    const { from, path } = drag;
    const to = target;
    drag = null;
    if (to >= 0 && to !== from) {
      save(moved(entries.map((e) => e.path), from, to));
      announce(path, to);
    }
  }

  /** How far a row shifts to make room for the dragged one. */
  function shift(index: number): number {
    if (!drag || index === drag.from || target < 0) return 0;
    if (drag.from < index && index <= target) return -drag.rowHeight;
    if (target <= index && index < drag.from) return drag.rowHeight;
    return 0;
  }

  function keydown(event: KeyboardEvent, entry: NavEntry, index: number) {
    const paths = entries.map((e) => e.path);
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (grabbed) {
        grabbed = null;
        announcement = `${entry.label} abgelegt an Position ${index + 1}.`;
      } else {
        grabbed = { path: entry.path, original: paths };
        announcement = `${entry.label} aufgenommen. Mit den Pfeiltasten verschieben, mit Leertaste ablegen.`;
      }
    } else if (grabbed && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      const to = index + (event.key === 'ArrowUp' ? -1 : 1);
      if (to < 0 || to >= paths.length) return;
      save(moved(paths, index, to));
      announce(entry.path, to);
      queueMicrotask(() => rows[to]?.focus());
    } else if (grabbed && event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      save(grabbed.original);
      grabbed = null;
      announcement = 'Verschieben abgebrochen.';
    }
  }

  function announce(path: string, to: number) {
    const label = entries.find((e) => e.path === path)?.label ?? '';
    announcement = `${label} jetzt an Position ${to + 1} von ${entries.length}.`;
  }
</script>

<div class="stack section">
  <p class="muted">
    Einträge an die gewünschte Stelle ziehen. Mit der Tastatur: Eintrag auswählen, Leertaste, Pfeiltasten, Leertaste.
    Einstellungen und Abmelden bleiben unten.
  </p>
  <ol class="entries" aria-label="Reihenfolge der Seitenleiste">
    {#each entries as entry, index (entry.path)}
      <li><div
        class="row-item"
        bind:this={rows[index]}
        tabindex="0"
        role="button"
        aria-pressed={grabbed?.path === entry.path}
        aria-roledescription="verschiebbarer Eintrag"
        aria-label="{entry.label}, Position {index + 1} von {entries.length}"
        class:dragging={drag?.path === entry.path}
        class:grabbed={grabbed?.path === entry.path}
        style:transform={drag?.path === entry.path ? `translateY(${drag.offset}px)` : shift(index) ? `translateY(${shift(index)}px)` : undefined}
        onpointerdown={(e) => pointerdown(e, entry, index)}
        onpointermove={pointermove}
        onpointerup={pointerup}
        onpointercancel={() => (drag = null)}
        onkeydown={(e) => keydown(e, entry, index)}
      >
        <span class="grip" aria-hidden="true"></span>
        <span class="label">{entry.label}</span>
        <span class="position muted">{index + 1}</span>
      </div></li>
    {/each}
  </ol>
  <p class="visually-hidden" aria-live="assertive">{announcement}</p>
  <div>
    <Button variant="ghost" disabled={!preferences.values.navOrder.length} onclick={() => save([])}>Standardreihenfolge</Button>
  </div>
</div>

<style>
  p {
    margin: 0;
  }
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
    grid-template-columns: 12px minmax(0, 1fr) auto;
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
    box-shadow: inset 2px 0 0 var(--color-accent);
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
  .position {
    font-variant-numeric: tabular-nums;
  }
</style>
