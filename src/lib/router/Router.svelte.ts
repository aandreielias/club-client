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

  start(): void {
    if (this.#started) return;
    this.#started = true;
    this.read();
    addEventListener('hashchange', () => this.read());
  }

  navigate(path: string): void {
    location.hash = path;
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
    const [path, query = ''] = location.hash.slice(1).split('?');
    this.path = path || '/';
    this.query = new URLSearchParams(query);
  }
}
