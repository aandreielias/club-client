import { describe, expect, it, vi } from 'vitest';
import type { LiveHandler, LiveUpdates } from '../../lib/live/LiveUpdates.svelte';
import { ToastService } from '../../lib/notify/ToastService.svelte';
import { NOTIFICATION_CREATED, NotificationCenter } from './NotificationCenter.svelte';
import type { NotificationsApi } from './NotificationsApi';
import type { Notification, NotificationList } from './model';

const entry = (id: string, read: boolean): Notification => ({
  id, kind: 'TASK_ASSIGNED', title: `T${id}`, body: '', link: null, createdAt: '2026-01-01T00:00:00Z', readAt: read ? '2026-01-01T01:00:00Z' : null,
});

function setup(list: NotificationList) {
  const handlers = new Map<string, LiveHandler>();
  const live = { subscribe: (type: string, handler: LiveHandler) => (handlers.set(type, handler), () => handlers.delete(type)) } as unknown as LiveUpdates;
  const api = {
    list: vi.fn(async () => structuredClone(list)),
    markRead: vi.fn(async () => {}),
    markAllRead: vi.fn(async () => {}),
  } as unknown as NotificationsApi & { list: ReturnType<typeof vi.fn>; markRead: ReturnType<typeof vi.fn> };
  const toasts = new ToastService(10, 10);
  const center = new NotificationCenter(api, live, toasts, true);
  return { center, api, handlers, toasts };
}

describe('NotificationCenter', () => {
  it('loads on start and reloads plus toasts on a live notification', async () => {
    const { center, api, handlers, toasts } = setup({ items: [entry('1', false)], unread: 1 });
    const stop = center.start();
    await vi.waitFor(() => expect(center.unread).toBe(1));
    handlers.get(NOTIFICATION_CREATED)!({ type: NOTIFICATION_CREATED, occurredAt: '', data: { notificationId: '2', kind: 'SECURITY', title: 'PIN geändert' } });
    expect(toasts.items.map((t) => t.text)).toEqual(['PIN geändert']);
    expect(api.list).toHaveBeenCalledTimes(2);
    stop();
    expect(handlers.size).toBe(0);
    expect(center.unread).toBe(0);
  });

  it('marks read optimistically and only once', async () => {
    const { center, api } = setup({ items: [entry('1', false), entry('2', true)], unread: 1 });
    center.start();
    await vi.waitFor(() => expect(center.unread).toBe(1));
    const [first, second] = center.inbox.value!.items;
    const pending = center.markRead(first);
    expect(center.unread).toBe(0);
    await pending;
    await center.markRead(second);
    expect(api.markRead).toHaveBeenCalledOnce();
  });

  it('marks everything read', async () => {
    const { center } = setup({ items: [entry('1', false), entry('2', false)], unread: 2 });
    center.start();
    await vi.waitFor(() => expect(center.unread).toBe(2));
    expect(await center.markAllRead()).toBe(true);
    expect(center.unread).toBe(0);
    expect(center.inbox.value!.items.every((n) => n.readAt)).toBe(true);
  });
});
