import { describe, expect, it } from 'vitest';
import { EventBus } from '../bus';
import { Router } from './Router.svelte';

const bus = () => new EventBus();

describe('Router.match', () => {
  it('matches static and parameter segments', () => {
    expect(Router.match('/', '/')).toEqual({});
    expect(Router.match('/account', '/account')).toEqual({});
    expect(Router.match('/calendar/:id', '/calendar/a%20b')).toEqual({ id: 'a b' });
    expect(Router.match('/calendar/:id/edit', '/calendar/7/edit')).toEqual({ id: '7' });
  });

  it('rejects other paths', () => {
    expect(Router.match('/calendar/:id', '/calendar')).toBeNull();
    expect(Router.match('/calendar/:id', '/files/1')).toBeNull();
    expect(Router.match('/', '/account')).toBeNull();
  });

  it('treats malformed escapes in a link as no match instead of throwing', () => {
    expect(Router.match('/tasks/:id', '/tasks/%E0')).toBeNull();
  });

  it('resolves the first matching route', () => {
    const router = new Router(bus());
    router.path = '/calendar/new';
    const routes = [{ path: '/calendar/new' }, { path: '/calendar/:id' }];
    expect(router.resolve(routes)?.route).toBe(routes[0]);
    router.path = '/calendar/42';
    expect(router.resolve(routes)).toEqual({ route: routes[1], params: { id: '42' } });
  });
});

describe('Router query helpers', () => {
  it('changes single keys and keeps the others', () => {
    const router = new Router(bus());
    router.path = '/calendar';
    router.query = new URLSearchParams('view=week&open=task/1');
    expect(router.withQuery({ date: '2026-10-20' })).toBe('/calendar?view=week&open=task%2F1&date=2026-10-20');
    expect(router.withQuery({ open: null, view: null })).toBe('/calendar');
  });
});
