import { Channel } from './Channel';
import { BusClosedError, NoResponderError, RequestTimeoutError } from './errors';
import type { DeadLetterHandler, EventBus, Payload, RequestHandler, SubscribeOptions, SubscriberExceptionHandler } from './EventBus';
import { Priority } from './Priority';
import { EventRegistry } from './registry/EventRegistry';
import type { EventRouter } from './routing/EventRouter';
import { Subscriber, type EventEnvelope, type EventHandler, type Subscription } from './Subscription';
import type { EventChannel, RequestChannel } from './tokens';

export interface BusConfig {
  router: EventRouter;
  separator: string;
  requestTimeoutMs: number;
  maxHistory: number;
  onError: SubscriberExceptionHandler;
  onDeadLetter: DeadLetterHandler | null;
}

/** Request responders are subscribers whose handler answers instead of consuming. */
class Responder extends Subscriber<never> {
  constructor(
    id: string,
    channel: Channel,
    sequence: number,
    readonly answer: RequestHandler<unknown, unknown>,
    onEnd: (s: Responder) => void,
  ) {
    super(id, channel, Priority.NORMAL, false, sequence, () => {}, onEnd as (s: Subscriber<never>) => void);
  }
}

export class DefaultEventBus implements EventBus {
  readonly registry: EventRegistry;

  readonly #subscribers = new Map<string, Subscriber>();
  readonly #responders = new Map<string, Responder[]>();
  readonly #pending = new Set<(error: Error) => void>();
  #sequence = 0;
  #closed = false;

  constructor(private readonly config: BusConfig) {
    this.registry = new EventRegistry(config.maxHistory, () => [...this.#subscribers.values()]);
  }

  get separator(): string {
    return this.config.separator;
  }

  get closed(): boolean {
    return this.#closed;
  }

  parse(path: string): Channel {
    return Channel.parse(path, this.config.separator);
  }

  publish<T>(token: EventChannel<T>, ...args: Payload<T>): void {
    this.ensureOpen();
    const payload = args[0] as T;
    const envelope: EventEnvelope<T> = { channel: this.parse(token.path), payload, timestamp: Date.now() };
    const targets = this.config.router.route(envelope.channel);
    let delivered = 0;
    for (const subscriber of targets) {
      if (!subscriber.active) continue; // unsubscribed by an earlier handler of this event
      delivered++;
      try {
        (subscriber as Subscriber<T>).handler(payload, envelope);
      } catch (error) {
        this.safely(() => this.config.onError(error, subscriber, envelope));
      }
    }
    this.registry.record({ channel: token.path, payload, timestamp: envelope.timestamp, delivered });
    if (!delivered && this.config.onDeadLetter) this.safely(() => this.config.onDeadLetter!(envelope));
  }

  subscribe<T>(token: EventChannel<T>, handler: EventHandler<T>, options: SubscribeOptions = {}): Subscription {
    return this.add(this.parse(token.path), handler as EventHandler<unknown>, false, options);
  }

  subscribeHierarchy(path: string, handler: EventHandler<unknown>, options: SubscribeOptions = {}): Subscription {
    if (!this.config.router.hierarchical) throw new Error('subscribeHierarchy needs hierarchical routing.');
    return this.add(this.parse(path), handler, true, options);
  }

  handleRequest<Req, Res>(token: RequestChannel<Req, Res>, handler: RequestHandler<Req, Res>): Subscription {
    this.ensureOpen();
    const responder = new Responder(crypto.randomUUID(), this.parse(token.path), this.#sequence++, handler as RequestHandler<unknown, unknown>, (r) => {
      const list = this.#responders.get(token.path)?.filter((x) => x !== r) ?? [];
      if (list.length) this.#responders.set(token.path, list);
      else this.#responders.delete(token.path);
      this.#subscribers.delete(r.id);
    });
    this.#responders.set(token.path, [...(this.#responders.get(token.path) ?? []), responder]);
    this.#subscribers.set(responder.id, responder as unknown as Subscriber);
    return responder;
  }

  request<Req, Res>(token: RequestChannel<Req, Res>, request: Req, timeoutMs = token.timeoutMs ?? this.config.requestTimeoutMs): Promise<Res> {
    return this.ask(token.path, request, timeoutMs, (answers, settle) => {
      let failures = 0;
      answers.forEach((answer) =>
        answer.then(
          (value) => settle.resolve(value as Res),
          (error) => ++failures === answers.length && settle.reject(error),
        ),
      );
    });
  }

  requestAll<Req, Res>(token: RequestChannel<Req, Res>, request: Req, timeoutMs = token.timeoutMs ?? this.config.requestTimeoutMs): Promise<Res[]> {
    return this.ask(token.path, request, timeoutMs, (answers, settle) => {
      void Promise.allSettled(answers).then((results) => {
        const ok = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value as Res] : []));
        const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
        if (!ok.length && failed) settle.reject(failed.reason);
        else settle.resolve(ok);
      });
    });
  }

  getSubscription(id: string): Subscription | undefined {
    return this.#subscribers.get(id);
  }

  unsubscribe(id: string): boolean {
    const subscription = this.#subscribers.get(id);
    subscription?.unsubscribe();
    return !!subscription;
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    for (const subscriber of [...this.#subscribers.values()]) subscriber.unsubscribe();
    this.config.router.clear();
    for (const reject of [...this.#pending]) reject(new BusClosedError());
    this.#pending.clear();
  }

  private add(channel: Channel, handler: EventHandler<unknown>, hierarchy: boolean, options: SubscribeOptions): Subscription {
    this.ensureOpen();
    const subscriber = new Subscriber(crypto.randomUUID(), channel, options.priority ?? Priority.NORMAL, hierarchy, this.#sequence++, handler, (s) => {
      this.config.router.remove(s);
      this.#subscribers.delete(s.id);
    });
    this.config.router.add(subscriber);
    this.#subscribers.set(subscriber.id, subscriber);
    return subscriber;
  }

  /** Runs every responder of `path` and lets `collect` decide when the request settles. */
  private ask<T>(
    path: string,
    request: unknown,
    timeoutMs: number,
    collect: (answers: Promise<unknown>[], settle: { resolve: (value: T) => void; reject: (error: unknown) => void }) => void,
  ): Promise<T> {
    if (this.#closed) return Promise.reject(new BusClosedError());
    const responders = this.#responders.get(path) ?? [];
    if (!responders.length) return Promise.reject(new NoResponderError(path));
    return new Promise<T>((resolve, reject) => {
      let done = false;
      const finish = (action: () => void) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        this.#pending.delete(fail);
        action();
      };
      const fail = (error: unknown) => finish(() => reject(error));
      const timer = timeoutMs > 0 ? setTimeout(() => fail(new RequestTimeoutError(path, timeoutMs)), timeoutMs) : undefined;
      this.#pending.add(fail);
      // Responders run after the caller continues, like the Java bus's async request executor.
      const answers = responders.map((r) => Promise.resolve().then(() => r.answer(request)));
      collect(answers, { resolve: (value) => finish(() => resolve(value)), reject: fail });
    });
  }

  private ensureOpen(): void {
    if (this.#closed) throw new BusClosedError();
  }

  private safely(run: () => void): void {
    try {
      run();
    } catch (error) {
      console.error('Event bus callback failed', error);
    }
  }
}
