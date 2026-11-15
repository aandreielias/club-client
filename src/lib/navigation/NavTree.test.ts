import { describe, expect, it } from 'vitest';
import { groupsAbove, leafKeys, resolveTree, type NavDef } from './NavTree';

const tree: NavDef[] = ['a', { id: 'g', label: 'G', icon: 'club', children: ['b', { id: 'h', label: 'H', icon: 'files', children: ['c', 'd'] }] }];

describe('nav tree', () => {
  it('resolves visible leaves; a group with one entry shows that entry, an empty one disappears', () => {
    const all = resolveTree(tree, (k) => k);
    expect(all).toEqual([
      { leaf: 'a' },
      {
        group: tree[1],
        children: [{ leaf: 'b' }, { group: (tree[1] as { children: readonly NavDef[] }).children[1], children: [{ leaf: 'c' }, { leaf: 'd' }] }],
      },
    ]);
    expect(resolveTree(tree, (k) => (k === 'd' ? undefined : k))[1]).toMatchObject({ children: [{ leaf: 'b' }, { leaf: 'c' }] });
    expect(resolveTree(tree, (k) => (k === 'a' || k === 'b' ? k : undefined))).toEqual([{ leaf: 'a' }, { leaf: 'b' }]);
    expect(resolveTree(tree, (k) => (k === 'a' ? k : undefined))).toEqual([{ leaf: 'a' }]);
  });

  it('lists leaves in order and the groups above one', () => {
    expect(leafKeys(tree)).toEqual(['a', 'b', 'c', 'd']);
    expect(groupsAbove(tree, 'c')?.map((g) => g.id)).toEqual(['g', 'h']);
    expect(groupsAbove(tree, 'a')).toEqual([]);
    expect(groupsAbove(tree, 'x')).toBeNull();
  });
});
