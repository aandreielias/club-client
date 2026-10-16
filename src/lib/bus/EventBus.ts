import type { Channel } from './Channel';
import type { Priority } from './Priority';
import type { EventRegistry } from './registry/EventRegistry';
import type { EventEnvelope, EventHandler, Subscription } from './Subscription';
import type { EventChannel, RequestChannel } from './tokens';

// `0 extends 1 & T` catches `any` (e.g. a catch variable), which would otherwise match `void`.
export type Payload<T> = 0 extends 1 & T ? [payload: T] : [T] extends [void] ? [] : [payload: T];

export interface SubscribeOptions {
  priority?: Priority;
}

export type RequestHandler<Req, Res> = (request: Req) => Res | Promise<Res>;

/** Called with every handler failure; never reaches the publisher. */
export type SubscriberExceptionHandler = (error: unknown, subscription: Subscription, envelope: EventEnvelope) => void;

/** Called for every published event that no subscriber received. */
export type DeadLetterHandler = (envelope: EventEnvelope) => void;

/**
 * Pub/sub bus with hierarchical channels, priorities and request/response
 * (TypeScript port of ae.eventbus.core.EventBus). Components publish to channels and subscribe to
 * them without knowing each other. Dispatch is synchronous; handler errors are isolated.
 */
export interface EventBus {
  /** Channels typed `void` take no payload: `bus.publish(WINDOW_CLOSE)`. */
  publish<T>(channel: EventChannel<T>, ...payload: Payload<T>): void;

  subscribe<T>(channel: EventChannel<T>, handler: EventHandler<T>, options?: SubscribeOptions): Subscription;

  /** Receives events of `path` and all its child channels (needs hierarchical routing). */
  subscribeHierarchy(path: string, handler: EventHandler<unknown>, options?: SubscribeOptions): Subscription;

  /** Registers a responder; several responders per channel are allowed. */
  handleRequest<Req, Res>(channel: RequestChannel<Req, Res>, handler: RequestHandler<Req, Res>): Subscription;

  /** First successful answer; rejects when no responder exists, every responder failed or the timeout passed. */
  request<Req, Res>(channel: RequestChannel<Req, Res>, request: Req, timeoutMs?: number): Promise<Res>;

  /** Every successful answer; rejects only when all responders failed (or none exists). */
  requestAll<Req, Res>(channel: RequestChannel<Req, Res>, request: Req, timeoutMs?: number): Promise<Res[]>;

  getSubscription(id: string): Subscription | undefined;

  /** True if the subscription was live. */
  unsubscribe(id: string): boolean;

  readonly registry: EventRegistry;
  readonly separator: string;
  readonly closed: boolean;

  parse(path: string): Channel;

  /** Ends every subscription and rejects pending requests. */
  close(): void;
}
