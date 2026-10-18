// Mirrors of the club-server notifications DTOs.

export type NotificationKind = 'TASK_ASSIGNED' | 'TASK_DUE' | 'APPOINTMENT_CANCELLED' | 'SECURITY' | 'CHANGE_DECIDED';

export interface Notification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Server link, e.g. '/tasks/<id>'; resolved to a client route by LinkResolver. */
  link: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationList {
  /** Newest first, at most 100. */
  items: Notification[];
  unread: number;
}

export interface Preference {
  kind: NotificationKind;
  push: boolean;
  email: boolean;
}

export interface Preferences {
  items: Preference[];
}

/** Live event 'notifications.notification-created' (sent to the recipient only). */
export interface NotificationCreated {
  notificationId: string;
  kind: NotificationKind;
  title: string;
}

export const NOTIFICATION_KINDS: readonly { value: NotificationKind; label: string; hint: string }[] = [
  { value: 'TASK_ASSIGNED', label: 'Neue Aufgaben', hint: 'Wenn dir eine Aufgabe zugewiesen wird.' },
  { value: 'TASK_DUE', label: 'Fällige Aufgaben', hint: 'Etwa einen Tag vor der Fälligkeit.' },
  { value: 'APPOINTMENT_CANCELLED', label: 'Abgesagte Termine', hint: 'Wenn ein Termin für dich ausfällt.' },
  { value: 'CHANGE_DECIDED', label: 'Kontoänderungen', hint: 'Wenn der Vorstand über deine Änderungsanfrage entschieden hat.' },
  { value: 'SECURITY', label: 'Sicherheit', hint: 'PIN-Änderungen und Sperren. E-Mails dazu werden immer gesendet.' },
];

/** Security e-mails cannot be switched off (server rule). */
export const isLockedEmail = (kind: NotificationKind): boolean => kind === 'SECURITY';
