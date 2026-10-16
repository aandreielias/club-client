import type { FeedEntry } from '../../lib/activity/ActivityApi';
import type { WindowTarget } from '../../lib/window/WindowService.svelte';

/** The window of the changed record; null when the record is gone. */
export function recordWindow(e: FeedEntry): WindowTarget | null {
  if (e.action === 'DELETED') return null;
  if (e.kind === 'TASK') return { kind: 'task', id: e.recordId };
  if (e.kind === 'APPOINTMENT') return { kind: 'appointment', id: e.recordId };
  return e.parentId ? { kind: 'file', id: `${e.parentId}:${e.recordId}` } : null;
}
