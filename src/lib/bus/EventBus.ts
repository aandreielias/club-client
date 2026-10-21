import type { EventChannel, RequestChannel } from './tokens';

// `0 extends 1 & T` catches `any` (e.g. a catch variable), which would otherwise match `void`.
export type Payload<T> = 0 extends 1 & T ? [payload: T] : [T] extends [void] ? [] : [payload: T];

export type EventHandler<T> = (payload: T) => void;

export interface Subscription {
  unsubscribe(): void;
}

/**
 * The app's pub/sub: components publish to typed channels and subscribe without knowing each other.
 * Dispatch is synchronous and exact (one channel path, no hierarchy); a failing handler is logged and never
 * reaches the publisher or the other handlers. A request channel has one responder (e.g. the confirm dialog).
 */
export class EventBus {
  readonly #handlers = new Map<string, Set<EventHandler<any>>>();
  readonly #responders = new Map<string, (request: any) => unknown>();

  /** Channels typed `void` take no payload: `bus.publish(WINDOW_CLOSE)`. */
  publish<T>(channel: EventChannel<T>, ...payload: Payload<T>): void {
    for (const handler of [...(this.#handlers.get(channel.path) ?? [])]) {
      try {
        handler(payload[0]);
      } catch (error) {
        console.error(`Handler on ${channel.path} failed`, error);
      }
    }
  }

  subscribe<T>(channel: EventChannel<T>, handler: EventHandler<T>): Subscription {
    let handlers = this.#handlers.get(channel.path);
    if (!handlers) this.#handlers.set(channel.path, (handlers = new Set()));
    handlers.add(handler);
    return { unsubscribe: () => handlers.delete(handler) };
  }

  /** Number of live handlers on a channel (tests check that components clean up). */
  subscribers(channel: EventChannel<unknown>): number {
    return this.#handlers.get(channel.path)?.size ?? 0;
  }

  handleRequest<Req, Res>(channel: RequestChannel<Req, Res>, responder: (request: Req) => Res | Promise<Res>): Subscription {
    this.#responders.set(channel.path, responder);
    return { unsubscribe: () => this.#responders.get(channel.path) === responder && this.#responders.delete(channel.path) };
  }

  /** The responder's answer; rejects when nobody answers this channel. */
  async request<Req, Res>(channel: RequestChannel<Req, Res>, request: Req): Promise<Res> {
    const responder = this.#responders.get(channel.path);
    if (!responder) throw new Error(`No responder on ${channel.path}`);
    return (await responder(request)) as Res;
  }
}
