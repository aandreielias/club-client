import { defineEvent, type EventBus } from '../bus';

/** Goes to a hash path; `replace` skips the history entry. */
export const NAVIGATE = defineEvent<{ path: string; replace?: boolean }>('ui/navigate');

export type RouteParams = Record<string, string>;

export interface Matchable {
  path: string;
}

export interface RouteMatch<R extends Matchable> {
  route: R;
  params: RouteParams;
}

/**
 * Hash router: GitHub Pages has no SPA fallback, so the route lives after '#'.
 * Patterns use ':name' segments; the first matching route wins, so list specific paths first.
 */
export class Router {
  path = $state('/');
  query = $state.raw(new URLSearchParams());

  #started = false;
  /** Path the member already agreed to leave for (the second hashchange must not ask again). */
  #allowed: string | null = null;

  constructor(
    bus: EventBus,
    /** Wraps a page change, e.g. in a View Transition; query-only changes skip it. */
    private readonly transition: (change: () => void) => void = (change) => change(),
    /** Asked before the page changes (unsaved input); false keeps the current page. */
    private readonly mayLeave: () => boolean | Promise<boolean> = () => true,
  ) {
    bus.subscribe(NAVIGATE, ({ path, replace }) => (replace ? this.replace(path) : this.navigate(path)));
  }

  start(): void {
    if (this.#started) return;
    this.#started = true;
    this.read();
    addEventListener('hashchange', () => this.read());
  }

  /**
   * Applies the change at once (not only on the later hashchange), so a second change right after it,
   * e.g. closing the window while opening the split view, builds on the new address instead of overwriting it.
   */
  navigate(path: string): void {
    location.hash = path;
    if (this.#started) this.read();
  }

  /** Current path with query keys changed (null removes a key); other keys are kept. */
  withQuery(changes: Readonly<Record<string, string | null>>): string {
    const query = new URLSearchParams(this.query);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) query.delete(key);
      else query.set(key, value);
    }
    const search = query.toString();
    return search ? `${this.path}?${search}` : this.path;
  }

  /** Applies query changes as a new history entry, or in place with `replace`. */
  updateQuery(changes: Readonly<Record<string, string | null>>, replace = false): void {
    const target = this.withQuery(changes);
    if (replace) this.replace(target);
    else this.navigate(target);
  }

  /** Changes the route without a history entry (e.g. after consuming auth tokens). */
  replace(path: string): void {
    history.replaceState(null, '', `#${path}`);
    this.read();
  }

  resolve<R extends Matchable>(routes: readonly R[]): RouteMatch<R> | null {
    for (const route of routes) {
      const params = Router.match(route.path, this.path);
      if (params) return { route, params };
    }
    return null;
  }

  /** '/tasks/:id' matches '/tasks/42' → { id: '42' }; null when it does not match. */
  static match(pattern: string, path: string): RouteParams | null {
    const want = pattern.split('/').filter(Boolean);
    const got = path.split('/').filter(Boolean);
    if (want.length !== got.length) return null;
    const params: RouteParams = {};
    for (let i = 0; i < want.length; i++) {
      if (want[i].startsWith(':')) params[want[i].slice(1)] = decodeURIComponent(got[i]);
      else if (want[i] !== got[i]) return null;
    }
    return params;
  }

  private read(): void {
    const [raw, query = ''] = location.hash.slice(1).split('?');
    const path = raw || '/';
    const apply = () => {
      this.path = path;
      this.query = new URLSearchParams(query);
    };
    if (!this.#started || path === this.path) return apply();
    if (this.#allowed === path) {
      this.#allowed = null;
      return this.transition(apply);
    }
    const answer = this.mayLeave();
    if (answer === true) return this.transition(apply);
    // Not yet: put the old address back, then follow the link once the member agrees.
    const target = location.hash;
    history.replaceState(null, '', `#${this.withQuery({})}`);
    if (answer) {
      void answer.then((ok) => {
        if (!ok) return;
        this.#allowed = path;
        location.hash = target;
      });
    }
  }
}
