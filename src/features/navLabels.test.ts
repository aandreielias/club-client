import { describe, expect, it } from 'vitest';
import { features } from '.';
import { ALL_TABS } from './settings/settingsTree';

describe('navigation labels', () => {
  it('names every sidebar tab and settings tab differently, so no entry is ambiguous', () => {
    const labels = [...features.routes.filter((r) => r.nav).map((r) => r.nav!), ...ALL_TABS.map((t) => t.label)];
    expect(labels.filter((label, i) => labels.indexOf(label) !== i)).toEqual([]);
  });

  it('puts every sidebar tab in the tree', () => {
    const tree = JSON.stringify(features.layout.tree);
    expect(features.routes.filter((r) => r.nav && !r.navFooter && !tree.includes(`"${r.path}"`)).map((r) => r.path)).toEqual([]);
  });
});
