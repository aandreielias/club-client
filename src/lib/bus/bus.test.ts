import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BusClosedError,
  Channel,
  EventBusBuilder,
  NoResponderError,
  Priority,
  RequestTimeoutError,
  ValidationError,
  defineEvent,
  defineRequest,
} from './index';

const ORDER = defineEvent<string>('orders/eu/de');
const PING = defineRequest<number, string>('ping');

describe('Channel', () => {
  it('parses, walks parents and compares', () => {
    const c = Channel.parse('a/b/c');
    expect(c.segments).toEqual(['a', 'b', 'c']);
    expect(c.depth).toBe(3);
    expect(c.parent?.toString()).toBe('a/b');
    expect(Channel.of('a').isParentOf(c)).toBe(true);
    expect(c.isParentOf(c)).toBe(false);
    expect(c.isChildOf(Channel.of('a', 'b'))).toBe(true);
    expect(c.lineage().map(String)).toEqual(['a/b/c', 'a/b', 'a']);
    expect(Channel.parse('x.y', '.').toString()).toBe('x/y');
  });

  it('rejects empty paths and segments', () => {
    expect(() => Channel.parse('')).toThrow(ValidationError);
    expect(() => Channel.parse('a//b')).toThrow(ValidationError);
    expect(() => Channel.of('a/b')).toThrow(ValidationError);
  });
});

describe('EventBus publish/subscribe', () => {
  it('delivers payload and envelope to exact subscribers only', () => {
    const bus = EventBusBuilder.create().build();
    const exact = vi.fn();
    const other = vi.fn();
    bus.subscribe(ORDER, exact);
    bus.subscribe(defineEvent<string>('orders'), other);
    bus.publish(ORDER, 'ORD-1');
    expect(exact).toHaveBeenCalledWith('ORD-1', expect.objectContaining({ payload: 'ORD-1' }));
    expect(other).not.toHaveBeenCalled();
  });

  it('routes child events to hierarchy subscribers', () => {
    const bus = EventBusBuilder.create().withHierarchicalRouting().build();
    const audit = vi.fn();
    const plain = vi.fn();
    bus.subscribeHierarchy('orders', audit);
    bus.subscribe(defineEvent<string>('orders'), plain);
    bus.publish(ORDER, 'ORD-2');
    expect(audit).toHaveBeenCalledOnce();
    expect(audit.mock.calls[0][1].channel.toString()).toBe('orders/eu/de');
    expect(plain).not.toHaveBeenCalled();
  });

  it('refuses hierarchy subscriptions on an exact bus', () => {
    expect(() => EventBusBuilder.create().build().subscribeHierarchy('a', () => {})).toThrow();
  });

  it('runs subscribers by priority, ties in subscription order', () => {
    const bus = EventBusBuilder.create().build();
    const calls: string[] = [];
    bus.subscribe(ORDER, () => calls.push('monitor'), { priority: Priority.MONITOR });
    bus.subscribe(ORDER, () => calls.push('normal-1'));
    bus.subscribe(ORDER, () => calls.push('highest'), { priority: Priority.HIGHEST });
    bus.subscribe(ORDER, () => calls.push('normal-2'));
    bus.publish(ORDER, 'x');
    expect(calls).toEqual(['highest', 'normal-1', 'normal-2', 'monitor']);
  });

  it('stops delivering after unsubscribe, also when a handler unsubscribes a later one', () => {
    const bus = EventBusBuilder.create().build();
    const late = vi.fn();
    const subLate = bus.subscribe(ORDER, late, { priority: Priority.LOW });
    bus.subscribe(ORDER, () => subLate.unsubscribe(), { priority: Priority.HIGH });
    bus.publish(ORDER, 'x');
    expect(late).not.toHaveBeenCalled();
    expect(subLate.active).toBe(false);
    expect(bus.getSubscription(subLate.id)).toBeUndefined();
    expect(bus.unsubscribe(subLate.id)).toBe(false);
  });

  it('unsubscribes through a detached reference (used as a cleanup function)', () => {
    const bus = EventBusBuilder.create().build();
    const handler = vi.fn();
    const stop = bus.subscribe(ORDER, handler).unsubscribe;
    stop();
    bus.publish(ORDER, 'x');
    expect(handler).not.toHaveBeenCalled();
  });

  it('isolates handler errors', () => {
    const onError = vi.fn();
    const bus = EventBusBuilder.create().withExceptionHandler(onError).build();
    const after = vi.fn();
    bus.subscribe(ORDER, () => {
      throw new Error('boom');
    });
    bus.subscribe(ORDER, after);
    expect(() => bus.publish(ORDER, 'x')).not.toThrow();
    expect(after).toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.any(Error), expect.anything(), expect.objectContaining({ payload: 'x' }));
  });

  it('hands undelivered events to the dead-letter handler', () => {
    const dead = vi.fn();
    const bus = EventBusBuilder.create().withDeadLetterHandler(dead).build();
    bus.publish(ORDER, 'lost');
    expect(dead).toHaveBeenCalledWith(expect.objectContaining({ payload: 'lost' }));
  });

  it('keeps a bounded history and lists subscribers', () => {
    const bus = EventBusBuilder.create().withMaxHistorySize(2).build();
    bus.subscribe(ORDER, () => {});
    ['a', 'b', 'c'].forEach((p) => bus.publish(ORDER, p));
    expect(bus.registry.history().map((r) => r.payload)).toEqual(['b', 'c']);
    expect(bus.registry.channels()).toEqual(['orders/eu/de']);
    expect(bus.registry.subscriberInfo()).toHaveLength(1);
  });
});

describe('EventBus request/response', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('answers with the first successful responder', async () => {
    const bus = EventBusBuilder.create().build();
    bus.handleRequest(PING, () => Promise.reject(new Error('down')));
    bus.handleRequest(PING, (n) => `pong ${n}`);
    await expect(bus.request(PING, 1)).resolves.toBe('pong 1');
  });

  it('collects every successful answer', async () => {
    const bus = EventBusBuilder.create().build();
    bus.handleRequest(PING, () => 'a');
    bus.handleRequest(PING, () => {
      throw new Error('x');
    });
    bus.handleRequest(PING, async () => 'b');
    await expect(bus.requestAll(PING, 0)).resolves.toEqual(['a', 'b']);
  });

  it('fails when every responder fails, none exists, or time runs out', async () => {
    const bus = EventBusBuilder.create().withDefaultRequestTimeout(100).build();
    await expect(bus.request(PING, 0)).rejects.toBeInstanceOf(NoResponderError);
    const sub = bus.handleRequest(PING, () => {
      throw new Error('only');
    });
    await expect(bus.request(PING, 0)).rejects.toThrow('only');
    await expect(bus.requestAll(PING, 0)).rejects.toThrow('only');
    sub.unsubscribe();
    bus.handleRequest(PING, () => new Promise<string>(() => {}));
    const pending = bus.request(PING, 0);
    vi.advanceTimersByTime(100);
    await expect(pending).rejects.toBeInstanceOf(RequestTimeoutError);
  });

  it('rejects pending requests and new calls after close', async () => {
    const bus = EventBusBuilder.create().build();
    bus.handleRequest(PING, () => new Promise<string>(() => {}));
    const pending = bus.request(PING, 0);
    bus.close();
    await expect(pending).rejects.toBeInstanceOf(BusClosedError);
    expect(() => bus.publish(ORDER, 'x')).toThrow(BusClosedError);
    expect(bus.closed).toBe(true);
  });
});
