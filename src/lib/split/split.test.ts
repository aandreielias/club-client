import { describe, expect, it } from 'vitest';
import { EventBus } from '../bus';
import { Router } from '../router/Router.svelte';
import { LocalStore } from '../storage/LocalStore';
import { MainPane, SplitPane } from './Pane';
import { SPLIT_OPEN, SplitView } from './SplitView.svelte';

/** A router whose URL is a plain string (no window.location in tests). */
function setup() {
  const bus = new EventBus();
  const router = new Router(bus);
  let url = '/';
  const apply = () => {
    const [path, query = ''] = url.split('?');
    router.path = path;
    router.query = new URLSearchParams(query);
  };
  router.navigate = (target) => ((url = target), apply());
  router.replace = (target) => ((url = target), apply());
  const memory = new Map<string, unknown>();
  const store = { get: (k: string) => memory.get(k), set: (k: string, v: unknown) => memory.set(k, v) } as unknown as LocalStore;
  const split = new SplitView(router, store, bus, { minRatio: 0.25, maxRatio: 0.75, step: 0.05, defaultPath: '/calendar' });
  return { bus, router, split, main: new MainPane(router, split), second: new SplitPane(split), url: () => url };
}

describe('SplitView', () => {
  it('keeps the second page in the main URL and lets each pane change its own location', () => {
    const { bus, split, main, second, url } = setup();
    main.navigate('/tasks');
    bus.publish(SPLIT_OPEN, { path: '/calendar?view=list' });
    expect(split.isOpen).toBe(true);
    expect(second.path).toBe('/calendar');
    expect(second.query.get('view')).toBe('list');
    expect(second.active).toBe(true);
    expect(main.active).toBe(false);

    second.updateQuery({ view: 'month', date: '2026-10-01' });
    expect(second.query.get('date')).toBe('2026-10-01');
    expect(url()).toBe('/tasks?split=%2Fcalendar%3Fview%3Dmonth%26date%3D2026-10-01');

    main.navigate('/files');
    expect(url().startsWith('/files?split=')).toBe(true);
    expect(second.path).toBe('/calendar');
  });

  it('swaps, toggles and limits the divider', () => {
    const { split, main, second, router } = setup();
    main.navigate('/tasks?team=t1');
    split.open('/calendar');
    split.swap();
    expect(router.path).toBe('/calendar');
    expect(second.path).toBe('/tasks');
    expect(second.query.get('team')).toBe('t1');
    split.toggle();
    expect(split.isOpen).toBe(false);
    split.toggle();
    expect(second.path).toBe('/tasks');
    split.setRatio(0.9);
    expect(split.ratio).toBe(0.75);
    split.nudge(-1);
    expect(split.ratio).toBeCloseTo(0.7);
  });
});
