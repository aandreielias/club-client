import { describe, expect, it, vi } from 'vitest';
import type { Router } from '../router/Router.svelte';
import type { LocalStore } from '../storage/LocalStore';
import { EventBusBuilder } from '../bus';
import { WINDOW_CLOSE, WINDOW_OPEN, WindowService } from './WindowService.svelte';

/** Minimal reactive router: history as a list of query strings. */
class FakeRouter {
  query = $state(new URLSearchParams());
  history: string[] = [''];
  path = '/tasks';

  updateQuery(changes: Record<string, string | null>, replace = false) {
    const next = new URLSearchParams(this.query);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
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
  const bus = EventBusBuilder.create().build();
  const saved = new Map<string, unknown>(stored ? [['window-dock', stored]] : []);
  const store = { get: (k: string) => saved.get(k) ?? null, set: (k: string, v: unknown) => saved.set(k, v) } as unknown as LocalStore;
  const windows = new WindowService(router as unknown as Router, store, 'center', bus);
  windows.register('task', { component: (() => {}) as never });
  vi.stubGlobal('history', { back: () => router.back() });
  return { router, windows, saved, bus };
}

describe('WindowService', () => {
  it('opens through the URL and closes with Back', () => {
    const { router, windows } = setup();
    windows.open('task', 't/1');
    expect(router.query.get('open')).toBe('task/t%2F1');
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

  it('remembers the dock placement', () => {
    const { windows, saved } = setup('side');
    expect(windows.dock).toBe('side');
    windows.setDock('bottom');
    expect(saved.get('window-dock')).toBe('bottom');
    expect(setup('nonsense').windows.dock).toBe('center');
  });

  it('rejects duplicate registrations', () => {
    const { windows } = setup();
    expect(() => windows.register('task', { component: (() => {}) as never })).toThrow();
  });

  it('opens in a dock and closes through bus commands', () => {
    const { windows, bus } = setup();
    bus.publish(WINDOW_OPEN, { kind: 'task', id: '7', dock: 'side' });
    expect(windows.current).toEqual({ kind: 'task', id: '7' });
    expect(windows.dock).toBe('side');
    bus.publish(WINDOW_CLOSE);
    expect(windows.current).toBeNull();
  });
});
