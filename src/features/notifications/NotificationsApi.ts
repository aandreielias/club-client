import type { ApiClient } from '../../lib/http/ApiClient';
import type { NotificationList, OutgoingMessage, Preference, Preferences } from './model';

/** Typed access to the inbox and notification preferences of the signed-in member. */
export class NotificationsApi {
  static readonly BASE = '/api/v1/me';

  constructor(private readonly api: ApiClient) {}

  list(unreadOnly = false): Promise<NotificationList> {
    return this.api.get<NotificationList>(`${NotificationsApi.BASE}/notifications`, { unreadOnly });
  }

  markRead(id: string): Promise<void> {
    return this.api.post(`${NotificationsApi.BASE}/notifications/${encodeURIComponent(id)}/read`);
  }

  markAllRead(): Promise<void> {
    return this.api.post(`${NotificationsApi.BASE}/notifications/read-all`);
  }

  /** Sends a message; resolves the number of people it reached. */
  async send(message: OutgoingMessage): Promise<number> {
    return (await this.api.post<{ recipients: number }>('/api/v1/notifications/messages', message)).recipients;
  }

  /** How many people the message would reach; nothing is sent. */
  async preview(message: OutgoingMessage): Promise<number> {
    return (await this.api.post<{ recipients: number }>('/api/v1/notifications/messages/preview', message)).recipients;
  }

  async preferences(): Promise<Preference[]> {
    return (await this.api.get<Preferences>(`${NotificationsApi.BASE}/notification-preferences`)).items;
  }

  async savePreferences(items: readonly Preference[]): Promise<Preference[]> {
    return (await this.api.put<Preferences>(`${NotificationsApi.BASE}/notification-preferences`, { items })).items;
  }
}
