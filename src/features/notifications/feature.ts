import type { Feature } from '../Feature';
import { PRIVILEGED } from '../../lib/types';
import MessageComposeView from './MessageComposeView.svelte';
import MessageView from './MessageView.svelte';
import { NOTIFICATION_MESSAGES } from './messages';
import NotificationSettingsPage from './NotificationSettingsPage.svelte';
import NotificationsPage from './NotificationsPage.svelte';
import NotificationsHome from './NotificationsHome.svelte';
import { notificationCenter } from './services';

export const notificationsFeature: Feature = {
  id: 'notifications',
  routes: [
    { path: '/notifications', component: NotificationsPage, nav: 'Benachrichtigungen', icon: 'notifications', badge: () => notificationCenter.unread },
    { path: '/notifications/settings', component: NotificationSettingsPage },
  ],
  windows: {
    message: { component: MessageView },
    'message-new': { component: MessageComposeView, roles: PRIVILEGED },
  },
  messages: NOTIFICATION_MESSAGES,
  start: () => notificationCenter.start(),
  home: { id: 'notifications', label: 'Benachrichtigungen', component: NotificationsHome, defaultShown: true },
};
