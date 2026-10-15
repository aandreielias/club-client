import type { WindowTarget } from '../window/WindowService.svelte';
import { Router, type RouteParams } from './Router.svelte';

/** Where a server link leads: a page or a detail window. */
export type LinkTarget = { path: string } | { window: WindowTarget };

/** Maps a link the server puts into messages (e.g. '/appointments/:id') to a client target. */
export interface LinkRule {
  server: string;
  to: (params: RouteParams) => LinkTarget;
}

/** Translates server links (notifications, e-mails) into pages or windows; features register their rules. */
export class LinkResolver {
  readonly #rules: LinkRule[] = [];

  register(rules: readonly LinkRule[]): this {
    this.#rules.push(...rules);
    return this;
  }

  /** Target of a server link, or null when no feature handles it. */
  resolve(serverLink: string | null): LinkTarget | null {
    if (!serverLink) return null;
    const path = serverLink.split(/[?#]/)[0];
    for (const rule of this.#rules) {
      const params = Router.match(rule.server, path);
      if (params) return rule.to(params);
    }
    return null;
  }
}
