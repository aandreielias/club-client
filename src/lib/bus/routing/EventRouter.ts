import type { Channel } from '../Channel';
import { Subscriber } from '../Subscription';

/** Decides which subscribers receive an event published on a channel (strategy). */
export interface EventRouter {
  readonly hierarchical: boolean;
  add(subscriber: Subscriber): void;
  remove(subscriber: Subscriber): void;
  /** Matching subscribers in dispatch order. */
  route(channel: Channel): Subscriber[];
  all(): Subscriber[];
  clear(): void;
}

/** Subscribers grouped by channel path. */
abstract class MapRouter implements EventRouter {
  abstract readonly hierarchical: boolean;
  protected readonly byPath = new Map<string, Subscriber[]>();

  add(subscriber: Subscriber): void {
    const key = subscriber.channel.toString();
    const list = this.byPath.get(key) ?? [];
    list.push(subscriber);
    this.byPath.set(key, list);
  }

  remove(subscriber: Subscriber): void {
    const key = subscriber.channel.toString();
    const list = this.byPath.get(key)?.filter((s) => s !== subscriber) ?? [];
    if (list.length) this.byPath.set(key, list);
    else this.byPath.delete(key);
  }

  all(): Subscriber[] {
    return [...this.byPath.values()].flat().sort(Subscriber.compare);
  }

  clear(): void {
    this.byPath.clear();
  }

  abstract route(channel: Channel): Subscriber[];
}

/** Only subscribers of exactly the published channel. */
export class ExactMatchRouter extends MapRouter {
  readonly hierarchical = false;

  route(channel: Channel): Subscriber[] {
    return [...(this.byPath.get(channel.toString()) ?? [])].sort(Subscriber.compare);
  }
}

/** Subscribers of the channel plus hierarchy subscribers of every ancestor. */
export class HierarchicalRouter extends MapRouter {
  readonly hierarchical = true;

  route(channel: Channel): Subscriber[] {
    const [self, ...ancestors] = channel.lineage();
    const direct = this.byPath.get(self.toString()) ?? [];
    const inherited = ancestors.flatMap((c) => (this.byPath.get(c.toString()) ?? []).filter((s) => s.hierarchy));
    return [...direct, ...inherited].sort(Subscriber.compare);
  }
}
