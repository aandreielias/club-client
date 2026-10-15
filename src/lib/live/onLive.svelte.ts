import type { LiveHandler, LiveUpdates } from './LiveUpdates.svelte';

/**
 * Subscribes a component to live events for its lifetime. Call during component initialisation.
 */
export function onLive<T>(live: LiveUpdates, types: string | readonly string[], handler: LiveHandler<T>): void {
  $effect(() => live.subscribe(types, handler));
}
