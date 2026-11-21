import type { EventBus, EventHandler } from './EventBus';
import type { EventChannel } from './tokens';
import { LIVE_RESYNC, isLiveChannel } from '../live/LiveUpdates.svelte';

/**
 * Subscribes a component to one or more channels for its lifetime. Call during component initialisation.
 * A handler without parameters on a server event also runs on `LIVE_RESYNC` (events missed while offline);
 * handlers that read the event subscribe to `LIVE_RESYNC` themselves.
 */
export function useBus<T>(bus: EventBus, channel: EventChannel<T>, handler: EventHandler<T>): void;
// Several channels carry different payloads, so the shared handler sees `unknown`.
export function useBus(bus: EventBus, channels: readonly EventChannel<any>[], handler: EventHandler<unknown>): void;
export function useBus(bus: EventBus, channels: EventChannel<unknown> | readonly EventChannel<unknown>[], handler: EventHandler<unknown>): void {
  const list = Array.isArray(channels) ? channels : [channels as EventChannel<unknown>];
  const resync = handler.length === 0 && list.some(isLiveChannel) ? [LIVE_RESYNC] : [];
  $effect(() => {
    const subscriptions = [...list, ...resync].map((channel) => bus.subscribe(channel, handler));
    return () => subscriptions.forEach((s) => s.unsubscribe());
  });
}
