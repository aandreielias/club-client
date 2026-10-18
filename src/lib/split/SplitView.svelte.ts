import { defineEvent, type EventBus } from '../bus';
import type { Router } from '../router/Router.svelte';
import type { LocalStore } from '../storage/LocalStore';

/** Opens a page in the second pane, e.g. from the sidebar's context menu. */
export const SPLIT_OPEN = defineEvent<{ path: string }>('ui/split/open');

export type PaneId = 'main' | 'split';

export interface SplitLimits {
  minRatio: number;
  maxRatio: number;
  step: number;
  defaultPath: string;
}

/** "/calendar?view=list" → ["/calendar", URLSearchParams]. */
export function parseLocation(location: string): [string, URLSearchParams] {
  const [path, query = ''] = location.split('?');
  return [path || '/', new URLSearchParams(query)];
}

/**
 * The second page next to the main one. Its location (path and query) lives in the main URL as
 * `?split=…`, like the window's `?open=…`, so reload, back and shared links keep it. Only one pane
 * owns the keyboard: the one last clicked or focused.
 */
export class SplitView {
  static readonly PARAM = 'split';
  static readonly STORE_KEY = 'split';

  /** Share of the width the main pane takes. */
  ratio = $state(0.5);
  focused = $state<PaneId>('main');

  constructor(
    private readonly router: Router,
    private readonly store: LocalStore,
    bus: EventBus,
    private readonly limits: SplitLimits,
  ) {
    const saved = store.get<{ ratio?: number; last?: string }>(SplitView.STORE_KEY);
    if (typeof saved?.ratio === 'number') this.ratio = this.clamp(saved.ratio);
    bus.subscribe(SPLIT_OPEN, ({ path }) => this.open(path));
  }

  /** Location of the second pane, or null when the split is closed. */
  get location(): string | null {
    return this.router.query.get(SplitView.PARAM);
  }

  get isOpen(): boolean {
    return this.location !== null;
  }

  open(location: string, replace = false): void {
    this.remember({ last: location });
    this.router.updateQuery({ [SplitView.PARAM]: location }, replace);
    this.focused = 'split';
  }

  close(): void {
    this.focused = 'main';
    this.router.updateQuery({ [SplitView.PARAM]: null });
  }

  /** Opens the last split page (or the default) or closes it. */
  toggle(): void {
    if (this.isOpen) this.close();
    else this.open(this.store.get<{ last?: string }>(SplitView.STORE_KEY)?.last ?? this.limits.defaultPath);
  }

  /** The second page becomes the main one and the other way round. */
  swap(): void {
    const other = this.location;
    if (other === null) return;
    const main = this.router.withQuery({ [SplitView.PARAM]: null, open: null });
    const [path, query] = parseLocation(other);
    query.set(SplitView.PARAM, main);
    this.remember({ last: main });
    this.focused = 'main';
    this.router.navigate(`${path}?${query}`);
  }

  setRatio(ratio: number): void {
    this.ratio = this.clamp(ratio);
    this.remember({ ratio: this.ratio });
  }

  nudge(direction: 1 | -1): void {
    this.setRatio(this.ratio + direction * this.limits.step);
  }

  private clamp(ratio: number): number {
    return Math.min(this.limits.maxRatio, Math.max(this.limits.minRatio, ratio));
  }

  private remember(changes: { ratio?: number; last?: string }): void {
    this.store.set(SplitView.STORE_KEY, { ...this.store.get<object>(SplitView.STORE_KEY), ...changes });
  }
}
