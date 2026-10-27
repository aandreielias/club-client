// Mirrors of the club-server notifications DTOs.

export type NotificationKind =
  'TASK_ASSIGNED' | 'TASK_DUE' | 'APPOINTMENT_CANCELLED' | 'SECURITY' | 'CHANGE_DECIDED' | 'MESSAGE' | 'ITEM_REMINDER' | 'MEETING';

import type { LinkedRef, RefKind } from '../../lib/records/refs';

export { REF_ICONS, refWindow, type RefKind } from '../../lib/records/refs';

/** A linked record with its title when the message was sent. */
export type MessageRef = LinkedRef;

/** A message admin, board or a coach writes (server: MessagesController.MessageBody). */
export interface OutgoingMessage {
  title: string;
  body: string;
  everyone: boolean;
  teamIds: string[];
  memberIds: string[];
  includeGuardians: boolean;
  refs: { kind: RefKind; id: string }[];
}

export interface Notification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Server link, e.g. '/tasks/<id>'; resolved to a client route by LinkResolver. */
  link: string | null;
  createdAt: string;
  readAt: string | null;
  /** Messages people wrote: who sent it and which records it links. */
  senderId: string | null;
  /** The recipient may not open the sender's profile, so the name comes along. */
  senderName: string | null;
  refs: MessageRef[];
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
  { value: 'ITEM_REMINDER', label: 'Gegenstände mitbringen', hint: 'Etwa einen Tag vor einem Termin, für den du etwas aus dem Inventar hast.' },
  { value: 'CHANGE_DECIDED', label: 'Kontoänderungen', hint: 'Wenn der Vorstand über deine Änderungsanfrage entschieden hat.' },
  { value: 'MESSAGE', label: 'Nachrichten vom Verein', hint: 'Nachrichten von Vorstand und Trainer:innen an dich oder dein Team.' },
  { value: 'MEETING', label: 'Sitzungen', hint: 'Einladungen, Umlaufbeschlüsse und Erinnerungen an Fristen. Werden immer gesendet.' },
  { value: 'SECURITY', label: 'Sicherheit', hint: 'Vereins-PIN, Sperren und neue Geräte. Werden immer gesendet.' },
];

/** Important kinds always go out by push and e-mail (server: NotificationsApi.IMPORTANT). */
export const isImportant = (kind: NotificationKind): boolean => kind === 'SECURITY' || kind === 'MEETING';
