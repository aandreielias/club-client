import type { ApiClient } from '../../lib/http/ApiClient';
import type { NotificationList, Preference, Preferences } from './model';

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

  async preferences(): Promise<Preference[]> {
    return (await this.api.get<Preferences>(`${NotificationsApi.BASE}/notification-preferences`)).items;
  }

  async savePreferences(items: readonly Preference[]): Promise<Preference[]> {
    return (await this.api.put<Preferences>(`${NotificationsApi.BASE}/notification-preferences`, { items })).items;
  }
}
