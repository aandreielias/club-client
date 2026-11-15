import { groupsAbove, leafKeys, resolveTree, type NavDef, type NavNode } from './NavTree';

/** One top-level sidebar row: a group (shown as a tree) or a single tab. */
export interface NavRow<T> {
  /** Order key: `group:<id>` for a top-level group, also when it shows a single tab; else the path. */
  key: string;
  node: NavNode<T>;
}

/**
 * The main sidebar tree; its top-level order is the default. Role filtering happens before: a group keeps only the tabs the
 * member sees, shows a single one in its place and disappears without any. Members reorder top-level rows only.
 */
export class NavLayout {
  constructor(
    readonly tree: readonly NavDef[] = [],
    /** Row keys of earlier layouts → their row now (saved orders). */
    readonly legacy: Readonly<Record<string, string>> = {},
  ) {}

  static groupKey(id: string): string {
    return `group:${id}`;
  }

  /** Rows of the given entries, in the member's `userOrder` (row keys), then the tree's order; entries outside the tree last. */
  arrange<T extends { path: string }>(entries: readonly T[], userOrder: readonly string[]): NavRow<T>[] {
    const find = (path: string) => entries.find((e) => e.path === path);
    const inTree = new Set(leafKeys(this.tree));
    const rows: NavRow<T>[] = [
      ...this.tree.flatMap((def) => {
        const [node] = resolveTree([def], find);
        return node ? [{ key: typeof def === 'string' ? def : NavLayout.groupKey(def.id), node }] : [];
      }),
      ...entries.filter((e) => !inTree.has(e.path)).map((e) => ({ key: e.path, node: { leaf: e } })),
    ];
    const user = this.migrate(userOrder);
    const rank = (key: string) => {
      const index = user.indexOf(key);
      return index < 0 ? user.length : index;
    };
    return rows
      .map((row, i) => ({ row, i }))
      .sort((a, b) => rank(a.row.key) - rank(b.row.key) || a.i - b.i)
      .map((x) => x.row);
  }

  /** An order saved with another layout: a tab now in a group, or an old group, takes the place of its top-level row. */
  private migrate(order: readonly string[]): string[] {
    return [
      ...new Set(
        order.map((key) => {
          const top = groupsAbove(this.tree, key)?.[0];
          return this.legacy[key] ?? (top ? NavLayout.groupKey(top.id) : key);
        }),
      ),
    ];
  }
}
