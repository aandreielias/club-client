import { defineEvent, EventBusBuilder, type EventBus } from '../bus';
import { guestOnly, type Role } from '../types';

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

/**
 * The mock server's event bus, built on the same EventBus as the app (the server uses the Java
 * original). Event type 'tasks.task-changed' travels on channel 'server/tasks/task-changed'.
 */
export class MockEventBus {
  static readonly ROOT = 'server';

  readonly #bus: EventBus = EventBusBuilder.create().withHierarchicalRouting().withMaxHistorySize(0).build();

  publish(event: MockEvent): void {
    this.#bus.publish(defineEvent<MockEvent>(`${MockEventBus.ROOT}/${event.type.replaceAll('.', '/')}`), event);
  }

  /** Every event, in publish order. */
  subscribe(listener: MockEventListener): () => void {
    const subscription = this.#bus.subscribeHierarchy(MockEventBus.ROOT, (event) => listener(event as MockEvent));
    return () => subscription.unsubscribe();
  }

  /** "Everyone" means the club: tournament guests get only what names them (server: Audience.includes). */
  static includes(audience: MockAudience, memberId: string, roles: readonly Role[]): boolean {
    return (!!audience.everyone && !guestOnly(roles)) || !!audience.members?.includes(memberId) || roles.some((r) => audience.roles?.includes(r));
  }
}
