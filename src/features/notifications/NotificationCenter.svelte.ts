import type { EventBus } from '../../lib/bus';
import { liveEvent } from '../../lib/live/LiveUpdates.svelte';
import { TOAST } from '../../lib/notify/ToastService.svelte';
import { Action } from '../../lib/state/Action.svelte';
import { Resource } from '../../lib/state/Resource.svelte';
import type { NotificationsApi } from './NotificationsApi';
import type { Notification, NotificationCreated, NotificationList } from './model';

export const NOTIFICATION_CREATED = liveEvent<NotificationCreated>('notifications.notification-created');

/**
 * The member's inbox, shared by the sidebar badge and the inbox page. Loads once per session and
 * reloads when the server announces a new notification.
 */
export class NotificationCenter {
  readonly inbox: Resource<NotificationList>;
  readonly markAllAction = new Action();
  readonly unread: number;

  constructor(
    private readonly api: NotificationsApi,
    private readonly bus: EventBus,
    private readonly toastOnArrival: boolean,
  ) {
    this.inbox = new Resource(() => this.api.list());
    this.unread = $derived(this.inbox.value?.unread ?? 0);
  }

  /** Session hook: initial load plus live refresh; returns the cleanup. */
  start(): () => void {
    void this.inbox.load();
    const subscription = this.bus.subscribe(NOTIFICATION_CREATED, ({ data }) => {
      if (this.toastOnArrival) this.bus.publish(TOAST, { text: data.title });
      void this.inbox.load();
    });
    return () => {
      subscription.unsubscribe();
      this.inbox.set({ items: [], unread: 0 });
    };
  }

  /** Marks one notification read; updates the local copy first so the badge reacts at once. */
  async markRead(notification: Notification): Promise<void> {
    if (notification.readAt) return;
    this.patch((list) => ({
      items: list.items.map((n) => (n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n)),
      unread: Math.max(0, list.unread - 1),
    }));
    try {
      await this.api.markRead(notification.id);
    } catch {
      await this.inbox.load(); // fall back to the server's state
    }
  }

  async markAllRead(): Promise<boolean> {
    const ok = await this.markAllAction.run(() => this.api.markAllRead());
    if (ok) {
      const now = new Date().toISOString();
      this.patch((list) => ({ items: list.items.map((n) => ({ ...n, readAt: n.readAt ?? now })), unread: 0 }));
    }
    return ok;
  }

  private patch(change: (list: NotificationList) => NotificationList): void {
    if (this.inbox.value) this.inbox.set(change(this.inbox.value));
  }
}
