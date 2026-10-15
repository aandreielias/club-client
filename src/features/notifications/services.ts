import { settings } from '../../settings';
import { api, live, toasts } from '../../lib/container';
import { NotificationCenter } from './NotificationCenter.svelte';
import { NotificationsApi } from './NotificationsApi';

/** Notification services, created once; the center lives for the whole signed-in session. */
export const notificationsApi = new NotificationsApi(api);
export const notificationCenter = new NotificationCenter(notificationsApi, live, toasts, settings.notifications.toastOnArrival);
