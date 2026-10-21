import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveSocket } from './LiveSocket';
import { EventBus } from '../bus';
import { CLOSE_CODES, LiveUpdates, liveEvent } from './LiveUpdates.svelte';

class FakeSocket implements LiveSocket {
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  readonly sent: unknown[] = [];
  closedWith: number | null = null;

  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close(code = 1000) {
    this.closedWith = code;
  }
  open() {
    this.onopen?.(new Event('open'));
  }
  receive(message: object) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(message) }));
  }
  drop(code: number) {
    this.onclose?.(new CloseEvent('close', { code }));
  }
}

const options = { reconnectMinMs: 1000, reconnectMaxMs: 8000, reauthLeadMs: 60_000 };

function setup(token: string | null = 'tok') {
  const sockets: FakeSocket[] = [];
  const onForbidden = vi.fn();
  const bus = new EventBus();
  const live = new LiveUpdates(
    async () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    async () => token,
    options,
    bus,
    onForbidden,
  );
  return { live, sockets, onForbidden, bus };
}

const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('LiveUpdates', () => {
  it('authenticates with the first message and goes online on auth.ok', async () => {
    const { live, sockets } = setup();
    live.start();
    await flush();
    sockets[0].open();
    await flush();
    expect(sockets[0].sent).toEqual([{ type: 'auth', token: 'tok' }]);
    expect(live.status).toBe('connecting');
    sockets[0].receive({ type: 'auth.ok', expiresAt: new Date(Date.now() + 600_000).toISOString() });
    expect(live.status).toBe('online');
  });

  it('publishes events on the bus by type', async () => {
    const { live, sockets, bus } = setup();
    const tasks = vi.fn();
    const sub = bus.subscribe(liveEvent('tasks.task-changed'), tasks);
    live.start();
    await flush();
    sockets[0].receive({ type: 'tasks.task-changed', occurredAt: 'x', data: { taskId: '1' } });
    sockets[0].receive({ type: 'files.files-changed', occurredAt: 'x', data: {} });
    expect(tasks).toHaveBeenCalledOnce();
    expect(tasks.mock.calls[0][0].data).toEqual({ taskId: '1' });
    sub.unsubscribe();
    sockets[0].receive({ type: 'tasks.task-changed', occurredAt: 'x', data: {} });
    expect(tasks).toHaveBeenCalledOnce();
  });

  it('reconnects with exponential backoff and resets it after auth.ok', async () => {
    const { live, sockets } = setup();
    live.start();
    await flush();
    sockets[0].drop(1006);
    expect(live.status).toBe('reconnecting');
    await vi.advanceTimersByTimeAsync(999);
    expect(sockets).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(sockets).toHaveLength(2);
    sockets[1].drop(CLOSE_CODES.unauthenticated);
    await vi.advanceTimersByTimeAsync(2000);
    expect(sockets).toHaveLength(3);
    sockets[2].receive({ type: 'auth.ok', expiresAt: new Date(Date.now() + 600_000).toISOString() });
    sockets[2].drop(1006);
    await vi.advanceTimersByTimeAsync(1000);
    expect(sockets).toHaveLength(4);
  });

  it('stops for good when the server refuses the member', async () => {
    const { live, sockets, onForbidden } = setup();
    live.start();
    await flush();
    sockets[0].drop(CLOSE_CODES.forbidden);
    expect(live.status).toBe('stopped');
    expect(onForbidden).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sockets).toHaveLength(1);
  });

  it('sends a fresh token before the current one expires', async () => {
    const { live, sockets } = setup();
    live.start();
    await flush();
    sockets[0].open();
    await flush();
    sockets[0].receive({ type: 'auth.ok', expiresAt: new Date(Date.now() + 120_000).toISOString() });
    await vi.advanceTimersByTimeAsync(59_000);
    expect(sockets[0].sent).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(sockets[0].sent).toHaveLength(2);
  });

  it('closes the socket and never reconnects after stop', async () => {
    const { live, sockets } = setup();
    live.start();
    await flush();
    live.stop();
    expect(sockets[0].closedWith).toBe(1000);
    sockets[0].drop(1000);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sockets).toHaveLength(1);
    expect(live.status).toBe('stopped');
  });

  it('gives up when there is no token', async () => {
    const { live, sockets } = setup(null);
    live.start();
    await flush();
    sockets[0].open();
    await flush();
    expect(live.status).toBe('stopped');
    expect(sockets[0].closedWith).toBe(1000);
  });
});
