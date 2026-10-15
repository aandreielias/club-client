import type { Role } from '../types';

/** Who receives a pushed event (server: platform.Audience). */
export interface MockAudience {
  everyone?: boolean;
  members?: readonly string[];
  roles?: readonly Role[];
}

/**
 * A domain event inside the mock server. Events with an audience are pushed to live connections
 * (like the server's ClientEvent); events without one stay internal (consumed by other mock modules).
 */
export interface MockEvent {
  type: string;
  data: unknown;
  audience?: MockAudience;
}

export type MockEventListener = (event: MockEvent) => void;

/** Stand-in for the server's EventBus between mock modules and towards live connections. */
export class MockEventBus {
  readonly #listeners = new Set<MockEventListener>();

  publish(event: MockEvent): void {
    for (const listener of [...this.#listeners]) listener(event);
  }

  subscribe(listener: MockEventListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  static includes(audience: MockAudience, memberId: string, roles: readonly Role[]): boolean {
    return !!audience.everyone || !!audience.members?.includes(memberId) || roles.some((r) => audience.roles?.includes(r));
  }
}
