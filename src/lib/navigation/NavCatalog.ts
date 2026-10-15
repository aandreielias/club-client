import type { Role } from '../types';

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

  set(entries: readonly NavEntry[]): void {
    this.#entries = [...entries];
  }

  /** Entries the member may see, in the given order (paths not in `order` keep their default place at the end). */
  ordered(order: readonly string[], hasRole: (...roles: readonly Role[]) => boolean): NavEntry[] {
    return NavCatalog.sort(this.#entries.filter((e) => !e.roles || hasRole(...e.roles)), order);
  }

  static sort<T extends { path: string }>(items: readonly T[], order: readonly string[]): T[] {
    const rank = (path: string) => {
      const index = order.indexOf(path);
      return index < 0 ? order.length : index;
    };
    return items.map((item, i) => ({ item, i })).sort((a, b) => rank(a.item.path) - rank(b.item.path) || a.i - b.i).map((x) => x.item);
  }
}
