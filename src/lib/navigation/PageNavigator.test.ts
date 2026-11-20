import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../bus';
import { Router } from '../router/Router.svelte';
import type { LocalStore } from '../storage/LocalStore';
import { MainPane, SplitPane } from '../split/Pane';
import { SplitView } from '../split/SplitView.svelte';
import { PageNavigator } from './PageNavigator';

function setup(start: string) {
  const bus = new EventBus();
  const router = new Router(bus);
  let url = start;
  const apply = () => {
    const [path, query = ''] = url.split('?');
    router.path = path;
    router.query = new URLSearchParams(query);
  };
  router.navigate = (target) => ((url = target), apply());
  router.replace = (target) => ((url = target), apply());
  apply();
  const memory = new Map<string, unknown>();
  const store = { get: (k: string) => memory.get(k), set: (k: string, v: unknown) => memory.set(k, v) } as unknown as LocalStore;
  const split = new SplitView(router, store, bus, { minRatio: 0.25, maxRatio: 0.75, step: 0.05, defaultPath: '/calendar' });
  const windows = {
    get list() {
      return router.query.getAll('open').map((value) => ({ key: value, kind: 'task', id: value, dock: 'center' as const, minimized: false }));
    },
    carry: (path: string) => (router.query.has('open') ? `${path}?open=${router.query.getAll('open').join('&open=')}` : path),
    keepAcrossNavigation: vi.fn(),
  };
  const navigator = new PageNavigator(split, new MainPane(router, split), new SplitPane(split), windows);
  return { navigator, split, windows, url: () => decodeURIComponent(url) };
}

describe('PageNavigator', () => {
  it('changes only the pane last used and keeps the split', () => {
    const { navigator, split, url } = setup('/tasks?split=/calendar');
    split.focused = 'split';
    navigator.go('/teams');
    expect(url()).toBe('/tasks?split=/teams');
    split.focused = 'main';
    navigator.go('/files');
    expect(url()).toBe('/files?split=/teams');
  });

  it('keeps the open windows (docked or in the middle) and lets them close without going back a page', () => {
    const { navigator, windows, url } = setup('/tasks?open=task/t1@side&open=task/t2@center');
    navigator.go('/teams');
    expect(url()).toBe('/teams?open=task/t1@side&open=task/t2@center');
    expect(windows.keepAcrossNavigation).toHaveBeenCalled();
  });
});
