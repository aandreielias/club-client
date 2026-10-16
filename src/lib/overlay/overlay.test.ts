import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContextMenuService, isSeparator, type MenuEntry } from './ContextMenuService.svelte';
import { dropdownPosition, menuPosition, tooltipPosition } from './placement';
import { TooltipService } from './TooltipService.svelte';

/** Stand-in for a DOM element (tests run without a DOM). */
function element(): Element {
  const attributes = new Map<string, string>();
  return {
    isConnected: true,
    getBoundingClientRect: () => ({ left: 10, top: 10, right: 50, bottom: 30, width: 40, height: 20 }),
    setAttribute: (k: string, v: string) => attributes.set(k, v),
    getAttribute: (k: string) => attributes.get(k) ?? null,
    removeAttribute: (k: string) => attributes.delete(k),
  } as unknown as Element;
}

describe('ContextMenuService', () => {
  const run = () => {};
  it('drops leading, trailing and doubled separators and opens only with actions', () => {
    const menu = new ContextMenuService();
    const entries: MenuEntry[] = [{ separator: true }, { label: 'A', run }, { separator: true }, { separator: true }, { label: 'B', run }, { separator: true }];
    expect(ContextMenuService.clean(entries).map((e) => (isSeparator(e) ? '-' : e.label))).toEqual(['A', '-', 'B']);
    expect(menu.show(1, 2, [{ separator: true }])).toBe(false);
    expect(menu.current).toBeNull();
    expect(menu.show(1, 2, entries)).toBe(true);
    menu.close();
    expect(menu.current).toBeNull();
  });
});

describe('placement', () => {
  const viewport = { width: 800, height: 600 };
  it('flips a menu at the viewport edge', () => {
    expect(menuPosition({ x: 100, y: 100 }, { width: 200, height: 150 }, viewport, 6)).toEqual({ x: 100, y: 100 });
    expect(menuPosition({ x: 700, y: 550 }, { width: 200, height: 150 }, viewport, 6)).toEqual({ x: 500, y: 400 });
  });

  it('puts a tooltip below its anchor, above when there is no room, inside the viewport', () => {
    const anchor = { left: 0, top: 100, bottom: 120, width: 20 } as DOMRectReadOnly;
    expect(tooltipPosition(anchor, { width: 100, height: 30 }, viewport, 6)).toEqual({ x: 6, y: 126 });
    const low = { left: 400, top: 580, bottom: 598, width: 40 } as DOMRectReadOnly;
    expect(tooltipPosition(low, { width: 100, height: 30 }, viewport, 6)).toEqual({ x: 370, y: 544 });
  });
});

describe('TooltipService', () => {
  afterEach(() => vi.useRealTimers());

  it('waits on hover, shows at once on focus and while warm, and links the description', () => {
    vi.useFakeTimers();
    let now = 0;
    const tips = new TooltipService(500, 400, () => now);
    const a = element();
    const b = element();
    tips.show(a, 'Eins');
    expect(tips.current).toBeNull();
    vi.advanceTimersByTime(500);
    expect(tips.current?.text).toBe('Eins');
    expect(a.getAttribute('aria-describedby')).toBe(TooltipService.ID);

    tips.hide(b); // not the owner: ignored
    expect(tips.current).not.toBeNull();
    tips.hide(a);
    expect(a.getAttribute('aria-describedby')).toBeNull();

    now = 100;
    tips.show(b, 'Zwei'); // within the skip delay
    expect(tips.current?.text).toBe('Zwei');
    tips.hide(b);
    now = 2000;
    tips.show(a, 'Drei', true); // keyboard focus
    expect(tips.current?.text).toBe('Drei');
  });
});

describe('dropdownPosition', () => {
  const viewport = { width: 1000, height: 800 };
  const rect = (left: number, top: number, width = 200, height = 32) =>
    ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRectReadOnly;

  it('opens below, above when there is no room below, and stays inside the viewport', () => {
    expect(dropdownPosition(rect(100, 100), 280, 160, viewport, 4)).toEqual({ x: 100, y: 136 });
    expect(dropdownPosition(rect(100, 700), 280, 160, viewport, 4)).toEqual({ x: 100, y: 416 });
    expect(dropdownPosition(rect(900, 100, 50), 280, 160, viewport, 4).x).toBe(832);
  });
});
