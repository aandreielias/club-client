import type { Channel } from './Channel';
import type { Priority } from './Priority';

/** What a subscriber receives next to the payload. */
export interface EventEnvelope<T = unknown> {
  readonly channel: Channel;
  readonly payload: T;
  readonly timestamp: number;
}

export type EventHandler<T> = (payload: T, envelope: EventEnvelope<T>) => void;

/** Handle of one registration on the bus; `unsubscribe` is idempotent. */
export interface Subscription {
  readonly id: string;
  readonly channel: Channel;
  readonly priority: Priority;
  /** Receives events of child channels too (hierarchical routing). */
  readonly hierarchy: boolean;
  readonly active: boolean;
  unsubscribe(): void;
}

/** Internal subscriber record; the bus hands it out as its Subscription. */
export class Subscriber<T = unknown> implements Subscription {
  #active = true;

  constructor(
    readonly id: string,
    readonly channel: Channel,
    readonly priority: Priority,
    readonly hierarchy: boolean,
    /** Global registration order, breaks priority ties. */
    readonly sequence: number,
    readonly handler: EventHandler<T>,
    private readonly onEnd: (subscriber: Subscriber<T>) => void,
  ) {}

  get active(): boolean {
    return this.#active;
  }

  /** Bound, so it can be handed around as a cleanup (`return sub.unsubscribe`). */
  readonly unsubscribe = (): void => {
    if (!this.#active) return;
    this.#active = false;
    this.onEnd(this);
  };

  static compare(a: Subscriber, b: Subscriber): number {
    return b.priority - a.priority || a.sequence - b.sequence;
  }
}
