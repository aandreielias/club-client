import type { TokenSource } from '../http/Transport';
import type { LiveSocket, SocketFactory } from './LiveSocket';

/** A domain event pushed by the server, e.g. type 'tasks.task-changed'. */
export interface LiveEvent<T = unknown> {
  type: string;
  occurredAt: string;
  data: T;
}

export type LiveHandler<T = unknown> = (event: LiveEvent<T>) => void;

export type LiveStatus = 'stopped' | 'connecting' | 'online' | 'reconnecting';

export interface LiveOptions {
  reconnectMinMs: number;
  reconnectMaxMs: number;
  reauthLeadMs: number;
}

/** server: LiveUpdatesHandler close codes */
export const CLOSE_CODES = { badMessage: 4400, unauthenticated: 4401, forbidden: 4403 } as const;

/**
 * Client of the server's live-update channel. Authenticates with the first message (never in the
 * URL), re-authenticates before the token expires, reconnects with exponential backoff and hands
 * every event to the subscribers of its type. Features subscribe and reload what they show.
 */
export class LiveUpdates {
  status = $state<LiveStatus>('stopped');

  readonly #handlers = new Map<string, Set<LiveHandler>>();
  #socket: LiveSocket | null = null;
  #attempt = 0;
  #reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  #reauthTimer: ReturnType<typeof setTimeout> | undefined;
  /** Incremented on every start/stop, so callbacks of an old socket are ignored. */
  #generation = 0;

  constructor(
    private readonly openSocket: SocketFactory,
    private readonly token: TokenSource,
    private readonly options: LiveOptions,
    /** Called when the server refuses the member (deactivated): the session is over. */
    private readonly onForbidden: () => void = () => {},
  ) {}

  get running(): boolean {
    return this.status !== 'stopped';
  }

  start(): void {
    if (this.running) return;
    this.#generation++;
    this.#attempt = 0;
    this.status = 'connecting';
    void this.connect(this.#generation);
  }

  stop(): void {
    this.#generation++;
    this.clearTimers();
    this.status = 'stopped';
    const socket = this.#socket;
    this.#socket = null;
    socket?.close(1000, 'client stop');
  }

  /** Reconnects immediately if the connection is down (e.g. the tab became visible again). */
  wake(): void {
    if (this.status !== 'reconnecting') return;
    clearTimeout(this.#reconnectTimer);
    void this.connect(this.#generation);
  }

  /** Registers a handler for one or more event types ('*' = all); returns the unsubscribe function. */
  subscribe<T = unknown>(types: string | readonly string[], handler: LiveHandler<T>): () => void {
    const list = typeof types === 'string' ? [types] : types;
    for (const type of list) {
      let set = this.#handlers.get(type);
      if (!set) this.#handlers.set(type, (set = new Set()));
      set.add(handler as LiveHandler);
    }
    return () => list.forEach((type) => this.#handlers.get(type)?.delete(handler as LiveHandler));
  }

  private async connect(generation: number): Promise<void> {
    let socket: LiveSocket;
    try {
      socket = await this.openSocket();
    } catch {
      this.scheduleReconnect(generation);
      return;
    }
    if (generation !== this.#generation) {
      socket.close(1000, 'stale');
      return;
    }
    this.#socket = socket;
    socket.onopen = () => void this.authenticate(socket, generation);
    socket.onmessage = (event) => this.receive(socket, event.data, generation);
    socket.onclose = (event) => this.closed(socket, event.code, generation);
  }

  private async authenticate(socket: LiveSocket, generation: number): Promise<void> {
    const token = await this.token().catch(() => null);
    if (generation !== this.#generation || socket !== this.#socket) return;
    if (!token) {
      this.stop();
      return;
    }
    socket.send(JSON.stringify({ type: 'auth', token }));
  }

  private receive(socket: LiveSocket, raw: unknown, generation: number): void {
    if (generation !== this.#generation || socket !== this.#socket || typeof raw !== 'string') return;
    let message: { type?: unknown; expiresAt?: unknown };
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }
    if (message.type === 'auth.ok') {
      this.status = 'online';
      this.#attempt = 0;
      this.scheduleReauth(socket, String(message.expiresAt), generation);
      return;
    }
    if (typeof message.type === 'string') this.dispatch(message as LiveEvent);
  }

  private dispatch(event: LiveEvent): void {
    for (const key of [event.type, '*']) {
      for (const handler of this.#handlers.get(key) ?? []) {
        try {
          handler(event);
        } catch (error) {
          console.error(`Live handler for ${event.type} failed`, error);
        }
      }
    }
  }

  private closed(socket: LiveSocket, code: number, generation: number): void {
    if (generation !== this.#generation || socket !== this.#socket) return;
    this.#socket = null;
    clearTimeout(this.#reauthTimer);
    if (code === CLOSE_CODES.forbidden) {
      this.stop();
      this.onForbidden();
      return;
    }
    // 4401 (token expired) and network drops: a new connection fetches a fresh token.
    this.scheduleReconnect(generation);
  }

  private scheduleReconnect(generation: number): void {
    if (generation !== this.#generation) return;
    this.status = 'reconnecting';
    const delay = Math.min(this.options.reconnectMaxMs, this.options.reconnectMinMs * 2 ** this.#attempt++);
    clearTimeout(this.#reconnectTimer);
    this.#reconnectTimer = setTimeout(() => void this.connect(generation), delay);
  }

  private scheduleReauth(socket: LiveSocket, expiresAt: string, generation: number): void {
    clearTimeout(this.#reauthTimer);
    const expires = Date.parse(expiresAt);
    if (isNaN(expires)) return;
    const delay = Math.max(0, expires - Date.now() - this.options.reauthLeadMs);
    this.#reauthTimer = setTimeout(() => void this.authenticate(socket, generation), delay);
  }

  private clearTimers(): void {
    clearTimeout(this.#reconnectTimer);
    clearTimeout(this.#reauthTimer);
  }
}
