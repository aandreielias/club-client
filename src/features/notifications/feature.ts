import type { Feature } from '../Feature';
import { NOTIFICATION_MESSAGES } from './messages';
import NotificationsPage from './NotificationsPage.svelte';
import NotificationsHome from './NotificationsHome.svelte';
import { notificationCenter } from './services';

export const notificationsFeature: Feature = {
  id: 'notifications',
  routes: [
    {
      path: '/notifications',
      component: NotificationsPage,
      nav: 'Benachrichtigungen',
      icon: 'notifications',
      badge: () => notificationCenter.unread,
      guest: true,
    },
  ],
  messages: NOTIFICATION_MESSAGES,
  start: () => notificationCenter.start(),
  home: { id: 'notifications', label: 'Benachrichtigungen', component: NotificationsHome, defaultShown: true },
};
