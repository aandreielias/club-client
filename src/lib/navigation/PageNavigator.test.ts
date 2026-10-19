import { describe, expect, it, vi } from 'vitest';
import { EventBusBuilder } from '../bus';
import { Router } from '../router/Router.svelte';
import type { LocalStore } from '../storage/LocalStore';
import { MainPane, SplitPane } from '../split/Pane';
import { SplitView } from '../split/SplitView.svelte';
import type { Dock } from '../window/WindowService.svelte';
import { PageNavigator } from './PageNavigator';

function setup(start: string, dock: Dock = 'side') {
  const bus = EventBusBuilder.create().build();
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
    get current() {
      return router.query.get('open') ? { kind: 'task', id: 't1' } : null;
    },
    dock,
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

  it('keeps a docked window open and lets it close without going back a page', () => {
    const { navigator, windows, url } = setup('/tasks?open=task/t1');
    navigator.go('/teams');
    expect(url()).toBe('/teams?open=task/t1');
    expect(windows.keepAcrossNavigation).toHaveBeenCalled();
  });

  it('closes a centered window as before', () => {
    const { navigator, url } = setup('/tasks?open=task/t1', 'center');
    navigator.go('/teams');
    expect(url()).toBe('/teams');
  });
});
