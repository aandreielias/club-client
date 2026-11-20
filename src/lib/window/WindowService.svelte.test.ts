import { describe, expect, it, vi } from 'vitest';
import type { Router } from '../router/Router.svelte';
import type { LocalStore } from '../storage/LocalStore';
import { EventBus } from '../bus';
import { WINDOW_CLOSE, WINDOW_OPEN, WindowService } from './WindowService.svelte';

/** Minimal reactive router: history as a list of query strings. */
class FakeRouter {
  query = $state(new URLSearchParams());
  history: string[] = [''];
  path = '/tasks';

  updateQuery(changes: Record<string, string | readonly string[] | null>, replace = false) {
    const next = new URLSearchParams(this.query);
    for (const [k, v] of Object.entries(changes)) {
      next.delete(k);
      for (const one of v === null ? [] : typeof v === 'string' ? [v] : v) next.append(k, one);
    }
    if (replace) this.history[this.history.length - 1] = next.toString();
    else this.history.push(next.toString());
    this.query = next;
  }

  back() {
    this.history.pop();
    this.query = new URLSearchParams(this.history[this.history.length - 1]);
  }

  navigate = vi.fn();
}

function setup(stored: string | null = null) {
  const router = new FakeRouter();
  const bus = new EventBus();
  const saved = new Map<string, unknown>(stored ? [['window-dock', stored]] : []);
  const store = { get: (k: string) => saved.get(k) ?? null, set: (k: string, v: unknown) => saved.set(k, v) } as unknown as LocalStore;
  const windows = new WindowService(router as unknown as Router, store, 'center', bus);
  windows.register('task', { label: 'Aufgabe', component: (() => {}) as never });
  vi.stubGlobal('history', { back: () => router.back() });
  return { router, windows, saved, bus };
}

describe('WindowService', () => {
  it('opens through the URL and closes with Back', () => {
    const { router, windows } = setup();
    windows.open('task', 't/1');
    expect(router.query.getAll('open')).toEqual(['task/t%2F1@center']);
    expect(windows.current).toEqual({ kind: 'task', id: 't/1' });
    windows.open('task', 't-2'); // switching replaces the entry
    expect(router.history).toHaveLength(2);
    windows.close();
    expect(windows.current).toBeNull();
    expect(router.history).toEqual(['']);
  });

  it('opens from a shared link and closes without leaving the page', () => {
    const { router, windows } = setup();
    router.query = new URLSearchParams('open=task/t-9&view=week');
    expect(windows.current).toEqual({ kind: 'task', id: 't-9' });
    expect(windows.focused?.dock).toBe('center');
    windows.close();
    expect(router.query.toString()).toBe('view=week');
    expect(router.history).toHaveLength(1);
  });

  it('ignores unknown kinds and broken values', () => {
    const { router, windows } = setup();
    router.query = new URLSearchParams('open=nope/1');
    expect(windows.current).toBeNull();
    router.query = new URLSearchParams('open=task');
    expect(windows.current).toBeNull();
  });

  it('remembers the placement of new windows', () => {
    const { windows, saved } = setup('side');
    expect(windows.dock).toBe('side');
    windows.setDock('bottom');
    expect(saved.get('window-dock')).toBe('bottom');
    expect(setup('nonsense').windows.dock).toBe('center');
  });

  it('rejects duplicate registrations', () => {
    const { windows } = setup();
    expect(() => windows.register('task', { label: 'Aufgabe', component: (() => {}) as never })).toThrow();
  });

  it('opens in a dock and closes through bus commands', () => {
    const { windows, bus } = setup();
    bus.publish(WINDOW_OPEN, { kind: 'task', id: '7', dock: 'side' });
    expect(windows.focused).toMatchObject({ kind: 'task', id: '7', dock: 'side' });
    bus.publish(WINDOW_CLOSE);
    expect(windows.current).toBeNull();
  });

  it('goes back through records opened inside the window, then closes', () => {
    const { windows, bus } = setup();
    bus.publish(WINDOW_OPEN, { kind: 'task', id: '1' });
    const key = windows.focused!.key;
    const handle = windows.handle(key);
    handle.open('task', '2');
    handle.replace('task', '3'); // e.g. the created record replaces its form: no way back to it
    expect(windows.trailDepth(key)).toBe(1);
    windows.back();
    expect(windows.current).toEqual({ kind: 'task', id: '1' });
    windows.back();
    expect(windows.current).toBeNull();
  });

  it('starts a fresh history when a record is opened from outside', () => {
    const { windows, bus } = setup();
    bus.publish(WINDOW_OPEN, { kind: 'task', id: '1' });
    const key = windows.focused!.key;
    windows.handle(key).open('task', '2');
    bus.publish(WINDOW_OPEN, { kind: 'task', id: '5' });
    expect(windows.trailDepth(key)).toBe(0);
  });

  it('shows records from outside in the focused window and opens new ones on request', () => {
    const { windows, bus } = setup();
    bus.publish(WINDOW_OPEN, { kind: 'task', id: '1' });
    bus.publish(WINDOW_OPEN, { kind: 'task', id: '2' });
    expect(windows.list.map((w) => w.id)).toEqual(['2']);
    bus.publish(WINDOW_OPEN, { kind: 'task', id: '3', newWindow: true });
    expect(windows.list.map((w) => w.id)).toEqual(['2', '3']);
    expect(windows.current?.id).toBe('3');
    // A record already shown comes to the top instead of opening twice.
    bus.publish(WINDOW_OPEN, { kind: 'task', id: '2' });
    expect(windows.list).toHaveLength(2);
    expect(windows.current?.id).toBe('2');
  });

  it('keeps one window per edge: a window moved there sends the one before to the middle', () => {
    const { windows, bus } = setup();
    bus.publish(WINDOW_OPEN, { kind: 'task', id: '1', dock: 'side' });
    bus.publish(WINDOW_OPEN, { kind: 'task', id: '2', dock: 'bottom' });
    bus.publish(WINDOW_OPEN, { kind: 'task', id: '3', newWindow: true, dock: 'center' });
    expect(windows.list.map((w) => [w.id, w.dock])).toEqual([
      ['1', 'side'],
      ['2', 'bottom'],
      ['3', 'center'],
    ]);
    expect(windows.docked('side') && windows.docked('bottom')).toBe(true);
    windows.setDock('side');
    expect(windows.list.map((w) => [w.id, w.dock])).toEqual([
      ['1', 'center'],
      ['2', 'bottom'],
      ['3', 'side'],
    ]);
  });

  it('keeps a window key while it shows other records or moves, and stacks windows and the call', () => {
    const { windows, bus } = setup();
    bus.publish(WINDOW_OPEN, { kind: 'task', id: '1' });
    const first = windows.focused!.key;
    bus.publish(WINDOW_OPEN, { kind: 'task', id: '2', newWindow: true });
    const second = windows.focused!.key;
    windows.handle(first).open('task', '9');
    windows.setDock('side', first);
    expect(windows.list.map((w) => w.key)).toEqual([first, second]);
    windows.raise(WindowService.CALL);
    expect(windows.zIndex(WindowService.CALL)).toBeGreaterThan(windows.zIndex(second));
    windows.raise(first);
    expect(windows.focused?.key).toBe(first);
    expect(windows.zIndex(first)).toBeGreaterThan(windows.zIndex(WindowService.CALL));
  });

  it('closes a window in the middle of the list without touching the others or going back', () => {
    const { router, windows, bus } = setup();
    bus.publish(WINDOW_OPEN, { kind: 'task', id: '1' });
    bus.publish(WINDOW_OPEN, { kind: 'task', id: '2', newWindow: true });
    windows.close(undefined, windows.list[0].key);
    expect(windows.list.map((w) => w.id)).toEqual(['2']);
    expect(router.history).toHaveLength(3);
    // The rest was not opened by the last entry alone any more: closing replaces instead of going back.
    windows.close();
    expect(windows.list).toEqual([]);
    expect(router.history).toHaveLength(3);
  });

  it('minimizes windows to tabs and restores them, swapping with a window that took their edge', () => {
    const { router, windows, bus } = setup();
    bus.publish(WINDOW_OPEN, { kind: 'task', id: '1', dock: 'side' });
    const first = windows.focused!.key;
    bus.publish(WINDOW_OPEN, { kind: 'task', id: '2', newWindow: true, dock: 'center' });
    const second = windows.focused!.key;
    windows.minimize(first);
    windows.minimize(second);
    expect(router.query.getAll('open')).toEqual(['task/1@side.min', 'task/2@center.min']);
    expect(windows.tabs.map((w) => w.key)).toEqual([first, second]);
    expect(windows.focused).toBeNull();
    expect(windows.docked('side')).toBe(false);
    bus.publish(WINDOW_OPEN, { kind: 'task', id: '3', dock: 'side' });
    windows.restore(first);
    expect(windows.list.map((w) => [w.id, w.dock, w.minimized])).toEqual([
      ['1', 'side', false],
      ['2', 'center', true],
      ['3', 'side', true],
    ]);
    // Opening a record shown in a tab restores it.
    bus.publish(WINDOW_OPEN, { kind: 'task', id: '2' });
    expect(windows.focused?.key).toBe(second);
    expect(windows.tabs.map((w) => w.id)).toEqual(['3']);
    // Shown another way (here from inside a window), its tab closes.
    windows.handle(second).open('task', '3');
    expect(windows.tabs).toEqual([]);
    expect(windows.list.map((w) => w.id)).toEqual(['1', '3']);
  });

  it('opens a new window in the middle when its remembered edge is taken, leaving the old one in place', () => {
    const { windows, bus } = setup('side');
    bus.publish(WINDOW_OPEN, { kind: 'task', id: '1' });
    bus.publish(WINDOW_OPEN, { kind: 'task', id: '2', newWindow: true });
    expect(windows.list.map((w) => [w.id, w.dock])).toEqual([
      ['1', 'side'],
      ['2', 'center'],
    ]);
  });
});

describe('WindowService docked size', () => {
  const limits = { minSidePx: 320, minBottomPx: 200, pageMinWidthPx: 360, pageMinHeightPx: 160 };

  it('keeps the size within the window minimum and what the page needs', () => {
    const viewport = { width: 1200, height: 800 };
    expect(WindowService.clampSize('side', 100, viewport, limits)).toBe(320);
    expect(WindowService.clampSize('side', 1000, viewport, limits)).toBe(840);
    expect(WindowService.clampSize('bottom', 500, viewport, limits)).toBe(500);
    expect(WindowService.clampSize('bottom', 790, viewport, limits)).toBe(640);
  });

  it('remembers the dragged size per dock and resets to the default', () => {
    const { windows, saved } = setup();
    windows.setSize('side', 480.4);
    expect(windows.size).toEqual({ side: 480, bottom: null });
    expect(saved.get('window-size')).toEqual({ side: 480, bottom: null });
    windows.setSize('side', null);
    expect(windows.size.side).toBeNull();
  });
});
