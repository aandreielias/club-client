import type { EventBus } from '../../lib/bus';
import type { FeedEntry } from '../../lib/activity/ActivityApi';
import { WINDOW_OPEN, type WindowTarget } from '../../lib/window/WindowService.svelte';

/** The window of the changed record; null when the record is gone. */
export function recordWindow(e: FeedEntry): WindowTarget | null {
  if (e.action === 'DELETED') return null;
  if (e.kind === 'TASK') return { kind: 'task', id: e.recordId };
  if (e.kind === 'APPOINTMENT') return { kind: 'appointment', id: e.recordId };
  return e.parentId ? { kind: 'file', id: `${e.parentId}:${e.recordId}` } : null;
}

/** Opens the changed record, if it still exists. */
export function openRecord(bus: EventBus, e: FeedEntry): void {
  const target = recordWindow(e);
  if (target) bus.publish(WINDOW_OPEN, target);
}

/** Row key of a feed entry (the feed has no ids). */
export const entryKey = (e: FeedEntry): string => `${e.kind}:${e.recordId}:${e.at}:${e.action}`;
