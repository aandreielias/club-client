import { settings } from '../../settings';
import { api, bus } from '../../lib/container';
import { NotificationCenter } from './NotificationCenter.svelte';
import { NotificationsApi } from './NotificationsApi';

/** Notification services, created once; the center lives for the whole signed-in session. */
export const notificationsApi = new NotificationsApi(api);
export const notificationCenter = new NotificationCenter(notificationsApi, bus, settings.notifications.toastOnArrival);
