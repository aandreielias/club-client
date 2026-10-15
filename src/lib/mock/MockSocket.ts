import { DevAuthProvider } from '../auth/DevAuthProvider';
import { CLOSE_CODES } from '../live/LiveUpdates.svelte';
import type { LiveSocket } from '../live/LiveSocket';
import type { Member } from '../types';
import { MockEventBus } from './MockEventBus';

/**
 * In-browser stand-in for the server's /ws endpoint: same auth handshake, same message shape,
 * events filtered by audience.
 */
export class MockSocket implements LiveSocket {
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  #member: Member | null = null;
  #unsubscribe: (() => void) | null = null;
  #closed = false;

  constructor(
    private readonly events: MockEventBus,
    private readonly resolve: (email: string | null) => Member | null,
    private readonly tokenLifetimeMs: number,
  ) {
    setTimeout(() => this.onopen?.(new Event('open')));
  }

  send(data: string): void {
    if (this.#closed) return;
    let message: { type?: string; token?: string };
    try {
      message = JSON.parse(data);
    } catch {
      return this.close(CLOSE_CODES.badMessage);
    }
    if (message.type !== 'auth' || typeof message.token !== 'string') return this.close(CLOSE_CODES.badMessage);
    const member = this.resolve(DevAuthProvider.emailFromToken(message.token));
    if (!member) return this.close(CLOSE_CODES.forbidden);
    if (this.#member && this.#member.id !== member.id) return this.close(CLOSE_CODES.badMessage);
    this.#member = member;
    this.#unsubscribe ??= this.events.subscribe((event) => {
      const viewer = this.#member;
      // server: LiveUpdatesHandler closes the connections of a deactivated member with 4403
      if (event.type === 'members.member-deactivated' && (event.data as { memberId?: string }).memberId === viewer?.id) {
        this.close(CLOSE_CODES.forbidden);
        return;
      }
      if (!event.audience || !viewer || !MockEventBus.includes(event.audience, viewer.id, viewer.roles)) return;
      this.deliver({ type: event.type, occurredAt: new Date().toISOString(), data: event.data });
    });
    this.deliver({ type: 'auth.ok', expiresAt: new Date(Date.now() + this.tokenLifetimeMs).toISOString() });
  }

  close(code = 1000, reason = ''): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#unsubscribe?.();
    setTimeout(() => this.onclose?.(new CloseEvent('close', { code, reason })));
  }

  private deliver(message: object): void {
    // Asynchronous like a network: handlers never run inside the publishing mock write.
    setTimeout(() => {
      if (!this.#closed) this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(message) }));
    });
  }
}
