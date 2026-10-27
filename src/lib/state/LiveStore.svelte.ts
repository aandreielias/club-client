import { background } from './background';
import type { EventBus, EventChannel } from '../bus';
import type { LiveEvent } from '../live/LiveUpdates.svelte';

/**
 * Club data every page reads (types, rules, settings): a seeded value until the server's arrives, loaded at start and again on
 * every live event that says it changed. Subclasses add their lookups.
 */
export class LiveStore<T> {
  value: T = $state.raw() as T;

  constructor(
    private readonly fetch: () => Promise<T>,
    private readonly bus: EventBus,
    private readonly changed: EventChannel<LiveEvent<unknown>>,
    initial: T,
  ) {
    this.value = initial;
  }

  /** Loads now and on every change; returns the cleanup. */
  start(): () => void {
    background(this.load());
    return this.bus.subscribe(this.changed, () => background(this.load())).unsubscribe;
  }

  async load(): Promise<T> {
    this.value = await this.fetch();
    return this.value;
  }
}
