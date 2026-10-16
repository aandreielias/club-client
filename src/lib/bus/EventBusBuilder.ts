import { DEFAULT_SEPARATOR } from './Channel';
import { DefaultEventBus } from './DefaultEventBus';
import type { DeadLetterHandler, EventBus, SubscriberExceptionHandler } from './EventBus';
import { ExactMatchRouter, HierarchicalRouter } from './routing/EventRouter';

const logError: SubscriberExceptionHandler = (error, subscription) =>
  console.error(`Subscriber on "${subscription.channel.toString()}" failed`, error);

/** Fluent configuration; reusable, every `build()` creates an independent bus. */
export class EventBusBuilder {
  #hierarchical = false;
  #separator = DEFAULT_SEPARATOR;
  #requestTimeoutMs = 5000;
  #maxHistory = 1000;
  #onError: SubscriberExceptionHandler = logError;
  #onDeadLetter: DeadLetterHandler | null = null;

  static create(): EventBusBuilder {
    return new EventBusBuilder();
  }

  withHierarchicalRouting(): this {
    this.#hierarchical = true;
    return this;
  }

  withExactRouting(): this {
    this.#hierarchical = false;
    return this;
  }

  withChannelSeparator(separator: string): this {
    if (!separator) throw new Error('Separator must not be empty.');
    this.#separator = separator;
    return this;
  }

  withDefaultRequestTimeout(ms: number): this {
    this.#requestTimeoutMs = ms;
    return this;
  }

  /** 0 disables the history. */
  withMaxHistorySize(size: number): this {
    this.#maxHistory = size;
    return this;
  }

  withExceptionHandler(handler: SubscriberExceptionHandler): this {
    this.#onError = handler;
    return this;
  }

  withDeadLetterHandler(handler: DeadLetterHandler): this {
    this.#onDeadLetter = handler;
    return this;
  }

  build(): EventBus {
    return new DefaultEventBus({
      router: this.#hierarchical ? new HierarchicalRouter() : new ExactMatchRouter(),
      separator: this.#separator,
      requestTimeoutMs: this.#requestTimeoutMs,
      maxHistory: this.#maxHistory,
      onError: this.#onError,
      onDeadLetter: this.#onDeadLetter,
    });
  }
}
