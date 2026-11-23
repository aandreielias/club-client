import { lazy } from '../../ui/lazy';
import type { Feature } from '../Feature';
import { NOTIFICATION_MESSAGES } from './messages';
import { notificationCenter } from './services';

const NotificationsPage = lazy(() => import('./NotificationsPage.svelte'));
const NotificationsHome = lazy(() => import('./NotificationsHome.svelte'));

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
