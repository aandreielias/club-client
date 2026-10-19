import type { IconName } from '../../icons';

/** Sidebar tabs shown together behind one row (flyout); the first visible tab opens on click. */
export interface NavGroup {
  id: string;
  label: string;
  icon: IconName;
  paths: readonly string[];
}

/** One top-level sidebar row: a group (two or more visible tabs) or a single tab. */
export interface NavRow<T> {
  /** Order key: `group:<id>` for every tab of a group, also when it shows alone; else the path. */
  key: string;
  group: NavGroup | null;
  entries: T[];
}

/**
 * Groups and default order of the main sidebar. Role filtering happens before: a group keeps only
 * the tabs the member sees, shows a single one as a plain tab and disappears without any.
 */
export class NavLayout {
  constructor(
    readonly groups: readonly NavGroup[] = [],
    /** Default order of row keys; rows not named keep their place after these. */
    readonly order: readonly string[] = [],
  ) {}

  static groupKey(id: string): string {
    return `group:${id}`;
  }

  /** Rows of the given entries, in the member's `userOrder` (row keys), then the default order. */
  arrange<T extends { path: string }>(entries: readonly T[], userOrder: readonly string[]): NavRow<T>[] {
    const rows: NavRow<T>[] = [];
    const done = new Set<NavGroup>();
    for (const entry of entries) {
      const group = this.groupOf(entry.path);
      if (!group) rows.push({ key: entry.path, group: null, entries: [entry] });
      else if (!done.has(group)) {
        done.add(group);
        const children = group.paths.flatMap((path) => entries.filter((e) => e.path === path));
        rows.push({ key: NavLayout.groupKey(group.id), group: children.length > 1 ? group : null, entries: children });
      }
    }
    const user = this.migrate(userOrder);
    const rank = (key: string, order: readonly string[]) => {
      const index = order.indexOf(key);
      return index < 0 ? order.length : index;
    };
    return rows
      .map((row, i) => ({ row, i }))
      .sort((a, b) => rank(a.row.key, user) - rank(b.row.key, user) || rank(a.row.key, this.order) - rank(b.row.key, this.order) || a.i - b.i)
      .map((x) => x.row);
  }

  /** An order saved before a tab joined a group: the group takes the place of its first tab. */
  private migrate(order: readonly string[]): string[] {
    return [...new Set(order.map((key) => {
      const group = this.groupOf(key);
      return group ? NavLayout.groupKey(group.id) : key;
    }))];
  }

  private groupOf(path: string): NavGroup | undefined {
    return this.groups.find((g) => g.paths.includes(path));
  }
}
