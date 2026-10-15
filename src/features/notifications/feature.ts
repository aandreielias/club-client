import type { Feature } from '../Feature';
import { NOTIFICATION_MESSAGES } from './messages';
import NotificationSettingsPage from './NotificationSettingsPage.svelte';
import NotificationsPage from './NotificationsPage.svelte';
import { notificationCenter } from './services';

export const notificationsFeature: Feature = {
  id: 'notifications',
  routes: [
    { path: '/notifications', component: NotificationsPage, nav: 'Benachrichtigungen', badge: () => notificationCenter.unread },
    { path: '/notifications/settings', component: NotificationSettingsPage },
  ],
  messages: NOTIFICATION_MESSAGES,
  start: () => notificationCenter.start(),
};
