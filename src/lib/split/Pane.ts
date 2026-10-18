import { getContext, setContext } from 'svelte';
import type { Router } from '../router/Router.svelte';
import { parseLocation, SplitView, type PaneId } from './SplitView.svelte';

/**
 * Where a page lives: the main pane (the browser URL) or the second pane of the split view. Pages
 * read and change their own path and query through it, never the router directly, so the same page
 * works in both panes.
 */
export interface Pane {
  readonly id: PaneId;
  readonly path: string;
  readonly query: URLSearchParams;
  /** Owns the keyboard (always true without a split). */
  readonly active: boolean;
  navigate(location: string, replace?: boolean): void;
  updateQuery(changes: Readonly<Record<string, string | null>>, replace?: boolean): void;
}

/** The main pane: the router's path and query, minus the split's own parameter. */
export class MainPane implements Pane {
  readonly id = 'main';

  constructor(
    private readonly router: Router,
    private readonly split: SplitView,
  ) {}

  get path(): string {
    return this.router.path;
  }

  get query(): URLSearchParams {
    return this.router.query;
  }

  get active(): boolean {
    return !this.split.isOpen || this.split.focused === 'main';
  }

  /** Keeps the split open while the main page changes. */
  navigate(location: string, replace = false): void {
    const split = this.split.location;
    if (split === null) return replace ? this.router.replace(location) : this.router.navigate(location);
    const [path, query] = parseLocation(location);
    query.set(SplitView.PARAM, split);
    const target = `${path}?${query}`;
    if (replace) this.router.replace(target);
    else this.router.navigate(target);
  }

  updateQuery(changes: Readonly<Record<string, string | null>>, replace = false): void {
    this.router.updateQuery(changes, replace);
  }
}

/** The second pane: its location is the `split` parameter of the main URL. */
export class SplitPane implements Pane {
  readonly id = 'split';

  constructor(private readonly split: SplitView) {}

  get path(): string {
    return parseLocation(this.split.location ?? '/')[0];
  }

  get query(): URLSearchParams {
    return parseLocation(this.split.location ?? '/')[1];
  }

  get active(): boolean {
    return this.split.focused === 'split';
  }

  navigate(location: string, replace = false): void {
    this.split.open(location, replace);
  }

  updateQuery(changes: Readonly<Record<string, string | null>>, replace = false): void {
    const query = new URLSearchParams(this.query);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) query.delete(key);
      else query.set(key, value);
    }
    const search = query.toString();
    this.split.open(search ? `${this.path}?${search}` : this.path, replace);
  }
}

const PANE = Symbol('pane');

export function providePane(pane: Pane): void {
  setContext(PANE, pane);
}

/** The pane the calling component is in; null outside any pane (windows, dialogs). Call during initialisation. */
export function currentPane(): Pane | null {
  return getContext<Pane | undefined>(PANE) ?? null;
}
