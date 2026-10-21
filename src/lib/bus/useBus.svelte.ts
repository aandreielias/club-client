import type { EventBus, EventHandler } from './EventBus';
import type { EventChannel } from './tokens';

/** Subscribes a component to one or more channels for its lifetime. Call during component initialisation. */
export function useBus<T>(bus: EventBus, channel: EventChannel<T>, handler: EventHandler<T>): void;
// Several channels carry different payloads, so the shared handler sees `unknown`.
export function useBus(bus: EventBus, channels: readonly EventChannel<any>[], handler: EventHandler<unknown>): void;
export function useBus(bus: EventBus, channels: EventChannel<unknown> | readonly EventChannel<unknown>[], handler: EventHandler<unknown>): void {
  const list = Array.isArray(channels) ? channels : [channels as EventChannel<unknown>];
  $effect(() => {
    const subscriptions = list.map((channel) => bus.subscribe(channel, handler));
    return () => subscriptions.forEach((s) => s.unsubscribe());
  });
}
