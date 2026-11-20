/**
 * Screen areas for Mod+Arrow: elements marked `data-area` (sidebar, page panes, windows, footer tabs, call).
 * Windows and the call are `data-area="window"`, which `w w` cycles through. Entering an area focuses
 * what had the focus there last, else its first control.
 */
export type Direction = 'left' | 'right' | 'up' | 'down';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';
const lastFocus = new WeakMap<HTMLElement, HTMLElement>();

/** Remembers per area the element focused last; call once at start. */
export function trackAreaFocus(): () => void {
  const onfocus = (event: FocusEvent) => {
    const target = event.target as HTMLElement;
    const area = target.closest?.<HTMLElement>('[data-area]');
    if (area && area !== target) lastFocus.set(area, target);
  };
  document.addEventListener('focusin', onfocus);
  return () => document.removeEventListener('focusin', onfocus);
}

const shown = (element: HTMLElement) => element.getClientRects().length > 0;
const areas = (selector = '[data-area]') => [...document.querySelectorAll<HTMLElement>(selector)].filter(shown);
const current = (list: HTMLElement[]) => [...list].reverse().find((area) => area.contains(document.activeElement));

/** Focuses the nearest area in a direction, judged by the middles of their boxes. */
export function focusArea(direction: Direction): boolean {
  const list = areas();
  const from = current(list);
  const box = from?.getBoundingClientRect() ?? new DOMRect(0, 0, innerWidth, innerHeight);
  const [x, y] = middle(box);
  const horizontal = direction === 'left' || direction === 'right';
  const sign = direction === 'left' || direction === 'up' ? -1 : 1;
  const best = list
    .filter((area) => area !== from)
    .map((area) => {
      const [ax, ay] = middle(area.getBoundingClientRect());
      const along = (horizontal ? ax - x : ay - y) * sign;
      const across = Math.abs(horizontal ? ay - y : ax - x);
      return { area, along, score: along + 2 * across };
    })
    .filter(({ along }) => along > 1)
    .sort((a, b) => a.score - b.score)[0];
  if (!best) return false;
  enter(best.area);
  return true;
}

/** Focuses the next window (or the call) after the one holding the focus. */
export function focusNextWindow(): boolean {
  const list = areas('[data-area="window"]');
  if (!list.length) return false;
  const at = list.indexOf(current(list) as HTMLElement);
  enter(list[(at + 1) % list.length]);
  return true;
}

function enter(area: HTMLElement): void {
  const remembered = lastFocus.get(area);
  const target =
    remembered?.isConnected && area.contains(remembered) && shown(remembered)
      ? remembered
      : [...area.querySelectorAll<HTMLElement>(FOCUSABLE)].find(shown);
  if (target) return target.focus();
  if (!area.hasAttribute('tabindex')) area.tabIndex = -1;
  area.focus();
}

function middle(box: DOMRect): [number, number] {
  return [box.left + box.width / 2, box.top + box.height / 2];
}
