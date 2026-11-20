import type { Attachment } from 'svelte/attachments';
import { KeyboardService } from '../lib/keyboard/KeyboardService.svelte';

export interface ArrowNavOptions {
  /** The focusable items inside the container. */
  items: string;
  /** vertical: up/down in document order; horizontal: left/right as drawn; grid: all four, up/down to the nearest item of the row above/below. */
  axis: 'vertical' | 'horizontal' | 'grid';
  /** Items inside these stay out (e.g. a flyout with its own keys). */
  skip?: string;
  /** Tree rows: right opens a closed group (`button[aria-expanded]`) or enters it, left closes it or goes up to its group. */
  tree?: boolean;
}

/**
 * Arrow keys (and Home/End) move the focus between the items of a container. The container is marked `data-arrow-nav`, so
 * the app's own arrow shortcuts (list rows, calendar days) leave keys pressed inside it alone (KeyboardService).
 */
export function arrowNav(options: ArrowNavOptions): Attachment<HTMLElement> {
  return (node) => {
    node.dataset.arrowNav = '';
    const onkey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || KeyboardService.isTyping(event.target)) return;
      // A control inside with arrows of its own (radio group, list box) keeps them.
      if ((event.target as HTMLElement).closest?.(KeyboardService.ARROW_OWNERS) !== node) return;
      const items = [...node.querySelectorAll<HTMLElement>(options.items)].filter(
        (item) => item.getClientRects().length > 0 && !(options.skip && item.closest(options.skip)),
      );
      const current = items.findIndex((item) => item.contains(document.activeElement));
      const next = target(event.key, items, current, options);
      if (next === undefined) return;
      event.preventDefault();
      if (next instanceof HTMLElement) next.focus();
      else next();
    };
    node.addEventListener('keydown', onkey);
    return () => {
      node.removeEventListener('keydown', onkey);
      delete node.dataset.arrowNav;
    };
  };
}

/** The item to focus, an action (open/close a tree group), or undefined for keys this container leaves alone. */
function target(key: string, items: HTMLElement[], current: number, options: ArrowNavOptions): HTMLElement | (() => void) | undefined {
  if (!items.length) return undefined;
  if (key === 'Home') return items[0];
  if (key === 'End') return items[items.length - 1];
  const item = items[current] as HTMLElement | undefined;
  const expanded = item?.matches('button[aria-expanded]') ? item.getAttribute('aria-expanded') === 'true' : null;
  if (options.tree && item && key === 'ArrowRight') {
    if (expanded === false) return () => item.click();
    if (expanded === true) return items[current + 1];
  }
  if (options.tree && item && key === 'ArrowLeft') {
    if (expanded === true) return () => item.click();
    return item.closest('ul')?.closest('li')?.querySelector<HTMLElement>(':scope > button[aria-expanded]') ?? undefined;
  }
  const order = options.axis === 'horizontal' ? [...items].sort(asDrawn) : items;
  const at = item ? order.indexOf(item) : -1;
  const step = (delta: number) => order[at < 0 ? (delta > 0 ? 0 : order.length - 1) : Math.min(Math.max(at + delta, 0), order.length - 1)];
  const along = options.axis === 'vertical' ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight'];
  if (key === along[0]) return step(-1);
  if (key === along[1]) return step(1);
  if (options.axis === 'grid' && (key === 'ArrowUp' || key === 'ArrowDown')) return item ? nearestInRow(item, items, key === 'ArrowDown') : items[0];
  return undefined;
}

/** Row by row, left to right (wrapped toolbars, reversed rows). */
function asDrawn(a: HTMLElement, b: HTMLElement): number {
  const x = a.getBoundingClientRect();
  const y = b.getBoundingClientRect();
  return Math.abs(x.top - y.top) > 4 ? x.top - y.top : x.left - y.left;
}

/** The item of the next row above or below whose middle is closest to this one's. */
function nearestInRow(item: HTMLElement, items: HTMLElement[], down: boolean): HTMLElement {
  const from = item.getBoundingClientRect();
  const rows = items
    .map((other) => ({ other, box: other.getBoundingClientRect() }))
    .filter(({ box }) => (down ? box.top >= from.bottom - 1 : box.bottom <= from.top + 1));
  if (!rows.length) return item;
  const rowTop = down ? Math.min(...rows.map(({ box }) => box.top)) : Math.max(...rows.map(({ box }) => box.top));
  const middle = from.left + from.width / 2;
  return rows
    .filter(({ box }) => Math.abs(box.top - rowTop) < 1)
    .reduce((best, next) =>
      Math.abs(next.box.left + next.box.width / 2 - middle) < Math.abs(best.box.left + best.box.width / 2 - middle) ? next : best,
    ).other;
}
