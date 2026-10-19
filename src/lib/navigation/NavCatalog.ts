import type { Role } from '../types';
import { NavLayout } from './NavLayout';

export interface NavEntry {
  path: string;
  label: string;
  roles?: readonly Role[];
}

/**
 * The main sidebar entries of all features (filled at start-up), so settings can offer to
 * reorder them without importing the features.
 */
export class NavCatalog {
  #entries: NavEntry[] = [];
  #layout = new NavLayout();

  set(entries: readonly NavEntry[], layout: NavLayout = new NavLayout()): void {
    this.#entries = [...entries];
    this.#layout = layout;
  }

  /** Top-level rows (groups and tabs) the member may see, in the given order of row keys. */
  ordered(order: readonly string[], hasRole: (...roles: readonly Role[]) => boolean): { key: string; label: string }[] {
    return this.#layout
      .arrange(this.#entries.filter((e) => !e.roles || hasRole(...e.roles)), order)
      .map((row) => ({ key: row.key, label: row.group?.label ?? row.entries[0].label }));
  }

  static sort<T extends { path: string }>(items: readonly T[], order: readonly string[]): T[] {
    const rank = (path: string) => {
      const index = order.indexOf(path);
      return index < 0 ? order.length : index;
    };
    return items.map((item, i) => ({ item, i })).sort((a, b) => rank(a.item.path) - rank(b.item.path) || a.i - b.i).map((x) => x.item);
  }
}
