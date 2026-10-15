import { describe, expect, it } from 'vitest';
import { FeatureRegistry } from '../../features/FeatureRegistry';
import { NavCatalog } from './NavCatalog';

const page = (() => {}) as never;

describe('Sidebar order', () => {
  const registry = new FeatureRegistry([
    { id: 'a', routes: [{ path: '/', component: page, nav: 'Start' }, { path: '/tasks', component: page, nav: 'Aufgaben' }] },
    { id: 'b', routes: [{ path: '/members', component: page, nav: 'Mitglieder', roles: ['ADMIN'] }] },
    { id: 'c', routes: [{ path: '/settings', component: page, nav: 'Einstellungen', navFooter: true }] },
  ]);

  it('follows the user order, keeps unknown entries last and footer entries at the bottom', () => {
    const items = registry.navigation(registry.routes, ['/tasks', '/gone']);
    expect(items.map((i) => i.path)).toEqual(['/tasks', '/', '/members', '/settings']);
    expect(items.at(-1)).toMatchObject({ footer: true });
  });

  it('offers only main entries the member may see for reordering', () => {
    const catalog = new NavCatalog();
    registry.registerNavigation(catalog);
    expect(catalog.ordered(['/tasks'], () => false).map((e) => e.path)).toEqual(['/tasks', '/']);
    expect(catalog.ordered([], () => true).map((e) => e.path)).toEqual(['/', '/tasks', '/members']);
  });
});
