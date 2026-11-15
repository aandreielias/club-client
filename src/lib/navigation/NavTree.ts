import type { IconName } from '../../icons';

/** A tree of navigation entries (sidebar, Einstellungen): a leaf is a key (route path, settings tab id), a group has children. */
export type NavDef = string | NavGroupDef;

export interface NavGroupDef {
  id: string;
  label: string;
  icon: IconName;
  children: readonly NavDef[];
}

/** The tree as one member sees it: groups with two or more visible entries, leaves resolved. */
export type NavNode<T> = { group: NavGroupDef; children: NavNode<T>[] } | { leaf: T };

/**
 * Resolves the leaves (`find` → undefined hides one). A group left without entries disappears; a group left with one entry
 * shows that entry in its place.
 */
export function resolveTree<T>(defs: readonly NavDef[], find: (key: string) => T | undefined): NavNode<T>[] {
  return defs.flatMap((def): NavNode<T>[] => {
    if (typeof def === 'string') {
      const leaf = find(def);
      return leaf === undefined ? [] : [{ leaf }];
    }
    const children = resolveTree(def.children, find);
    return children.length > 1 ? [{ group: def, children }] : children;
  });
}

/** Every leaf key, in tree order. */
export function leafKeys(defs: readonly NavDef[]): string[] {
  return defs.flatMap((def) => (typeof def === 'string' ? [def] : leafKeys(def.children)));
}

/** The groups above a leaf, outermost first; null when the key is not in the tree. */
export function groupsAbove(defs: readonly NavDef[], key: string): NavGroupDef[] | null {
  for (const def of defs) {
    if (def === key) return [];
    if (typeof def !== 'string') {
      const below = groupsAbove(def.children, key);
      if (below) return [def, ...below];
    }
  }
  return null;
}
