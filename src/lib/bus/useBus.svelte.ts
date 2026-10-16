import type { EventBus, SubscribeOptions } from './EventBus';
import type { EventHandler } from './Subscription';
import type { EventChannel } from './tokens';

/** Subscribes a component to one or more channels for its lifetime. Call during component initialisation. */
export function useBus<T>(bus: EventBus, channel: EventChannel<T>, handler: EventHandler<T>, options?: SubscribeOptions): void;
// Several channels carry different payloads, so the shared handler sees `unknown`.
export function useBus(bus: EventBus, channels: readonly EventChannel<any>[], handler: EventHandler<unknown>, options?: SubscribeOptions): void;
export function useBus(
  bus: EventBus,
  channels: EventChannel<unknown> | readonly EventChannel<unknown>[],
  handler: EventHandler<unknown>,
  options?: SubscribeOptions,
): void {
  const list = 'kind' in channels ? [channels] : channels;
  $effect(() => {
    const subscriptions = list.map((channel) => bus.subscribe(channel, handler, options));
    return () => subscriptions.forEach((s) => s.unsubscribe());
  });
}
