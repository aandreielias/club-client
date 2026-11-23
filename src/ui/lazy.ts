import type { Component } from 'svelte';
import Lazy from './Lazy.svelte';

/**
 * A component whose code loads when it is first shown, so pages and windows stay out of the startup bundle.
 * Usable wherever a component is expected: `component: lazy(() => import('./TasksPage.svelte'))`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- same constraint as svelte's Component
export function lazy<P extends Record<string, any>>(load: () => Promise<{ default: Component<P> }>): Component<P> {
  let loaded: Promise<Component<P>> | undefined;
  const get = () =>
    (loaded ??= load().then(
      (m) => m.default,
      (error: unknown) => {
        loaded = undefined; // let the next showing try again
        throw error;
      },
    ));
  return ((internals, props) =>
    Lazy(internals, {
      load: get,
      get props() {
        return props;
      },
    })) as Component<P>;
}
