import type { Subscription } from '../Subscription';

export interface EventRecord {
  readonly channel: string;
  readonly payload: unknown;
  readonly timestamp: number;
  /** Number of subscribers that received it (0 = dead letter). */
  readonly delivered: number;
}

export interface SubscriberInfo {
  readonly id: string;
  readonly channel: string;
  readonly priority: number;
  readonly hierarchy: boolean;
}

/** Introspection: bounded event history and the live subscriber list (debugging, tests). */
export class EventRegistry {
  #history: EventRecord[] = [];

  constructor(
    private readonly maxHistory: number,
    private readonly subscribers: () => readonly Subscription[],
  ) {}

  record(record: EventRecord): void {
    if (this.maxHistory <= 0) return;
    this.#history.push(record);
    if (this.#history.length > this.maxHistory) this.#history.splice(0, this.#history.length - this.maxHistory);
  }

  history(channel?: string): EventRecord[] {
    return channel ? this.#history.filter((r) => r.channel === channel) : [...this.#history];
  }

  channels(): string[] {
    return [...new Set(this.subscribers().map((s) => s.channel.toString()))].sort();
  }

  subscriberInfo(channel?: string): SubscriberInfo[] {
    return this.subscribers()
      .filter((s) => !channel || s.channel.toString() === channel)
      .map((s) => ({ id: s.id, channel: s.channel.toString(), priority: s.priority, hierarchy: s.hierarchy }));
  }

  clear(): void {
    this.#history = [];
  }
}
