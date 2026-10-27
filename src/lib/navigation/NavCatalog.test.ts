import { describe, expect, it } from 'vitest';
import { FeatureRegistry } from '../../features/FeatureRegistry';
import { NavCatalog } from './NavCatalog';
import { NavLayout } from './NavLayout';

const page = (() => {}) as never;

describe('Sidebar order', () => {
  const registry = new FeatureRegistry([
    {
      id: 'a',
      routes: [
        { path: '/', component: page, nav: 'Start' },
        { path: '/tasks', component: page, nav: 'Aufgaben' },
      ],
    },
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
    expect(catalog.ordered(['/tasks'], () => false).map((e) => e.key)).toEqual(['/tasks', '/']);
    expect(catalog.ordered([], () => true).map((e) => e.key)).toEqual(['/', '/tasks', '/members']);
  });
});

describe('Sidebar groups', () => {
  const layout = new NavLayout(
    [
      { id: 'verein', label: 'Verein', icon: 'teams', paths: ['/teams', '/members', '/locations'] },
      { id: 'ablage', label: 'Ablage', icon: 'files', paths: ['/files', '/inventory'] },
    ],
    ['/', '/tasks', 'group:ablage', 'group:verein'],
  );
  const registry = new FeatureRegistry(
    [
      {
        id: 'a',
        routes: [
          { path: '/members', component: page, nav: 'Mitglieder', roles: ['ADMIN'] },
          { path: '/teams', component: page, nav: 'Teams', badge: () => 2 },
          { path: '/locations', component: page, nav: 'Orte', badge: () => 1 },
          { path: '/inventory', component: page, nav: 'Inventar', roles: ['ADMIN'] },
          { path: '/files', component: page, nav: 'Dateien' },
          { path: '/tasks', component: page, nav: 'Aufgaben' },
          { path: '/', component: page, nav: 'Start' },
        ],
      },
    ],
    layout,
  );
  const member = registry.allowed(() => false);

  it('collapses tabs into groups in the default order, with the tabs in group order and summed badges', () => {
    const items = registry.navigation(registry.routes);
    expect(items.map((i) => i.key)).toEqual(['/', '/tasks', 'group:ablage', 'group:verein']);
    const verein = items.find((i) => i.key === 'group:verein')!;
    expect(verein).toMatchObject({ label: 'Verein', path: '/teams', badge: 3 });
    expect(verein.children!.map((c) => c.path)).toEqual(['/teams', '/members', '/locations']);
  });

  it('shows a group with one visible tab as that tab, and keeps its place', () => {
    const items = registry.navigation(member);
    expect(items.map((i) => i.path)).toEqual(['/', '/tasks', '/files', '/teams']);
    expect(items[2]).toMatchObject({ key: 'group:ablage', label: 'Dateien' });
    expect(items[2].children).toBeUndefined();
  });

  it('hides a group without visible tabs', () => {
    const only = new FeatureRegistry([{ id: 'x', routes: [{ path: '/inventory', component: page, nav: 'Inventar', roles: ['ADMIN'] }] }], layout);
    expect(only.navigation(only.allowed(() => false))).toEqual([]);
  });

  it('puts a group where an order saved before grouping had its first tab', () => {
    expect(registry.navigation(registry.routes, ['/locations', '/']).map((i) => i.key)).toEqual(['group:verein', '/', '/tasks', 'group:ablage']);
  });

  it('offers groups once for reordering', () => {
    const catalog = new NavCatalog();
    registry.registerNavigation(catalog);
    expect(catalog.ordered([], () => true)).toEqual([
      { key: '/', label: 'Start' },
      { key: '/tasks', label: 'Aufgaben' },
      { key: 'group:ablage', label: 'Ablage' },
      { key: 'group:verein', label: 'Verein' },
    ]);
  });
});
