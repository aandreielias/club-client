// Mirrors of the club-server notifications DTOs.

export type NotificationKind =
  | 'TASK_ACTIVITY'
  | 'TEAM'
  | 'TASK_ASSIGNED'
  | 'TASK_DUE'
  | 'APPOINTMENT_CANCELLED'
  | 'CHANGE_DECIDED'
  | 'MESSAGE'
  | 'ITEM_REMINDER'
  | 'MEETING'
  | 'MAIL'
  | 'APPOINTMENT_CHANGED'
  | 'ATTENDANCE'
  | 'RIDE';

import type { LinkedRef, RefKind } from '../../lib/records/refs';

export type { RefKind } from '../../lib/records/refs';

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
  /** A received message (inbox id): the answer goes to its sender only; anyone may answer. */
  replyTo?: string;
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
  {
    value: 'TASK_ACTIVITY',
    label: 'Kommentare und erledigte Aufgaben',
    hint: 'Neue Kommentare zu deinen Aufgaben; wenn eine Aufgabe, die du angelegt hast, erledigt ist.',
  },
  { value: 'TASK_DUE', label: 'Fällige Aufgaben', hint: 'Vor der Fälligkeit; wie lange vorher, legt der Verein fest.' },
  { value: 'APPOINTMENT_CANCELLED', label: 'Abgesagte Termine', hint: 'Wenn ein Termin für dich ausfällt.' },
  { value: 'APPOINTMENT_CHANGED', label: 'Geänderte Termine', hint: 'Neue Zeit, neuer Ort oder neue Kabine eines kommenden Termins.' },
  {
    value: 'ATTENDANCE',
    label: 'Zu- und Absagen',
    hint: 'Erinnerung, wenn du noch nicht geantwortet hast; für Trainer:innen: Abwesenheit trotz Zusage.',
  },
  { value: 'RIDE', label: 'Fahrgemeinschaften', hint: 'Wer in dein Auto steigt oder aussteigt, und wenn deine Mitfahrt ausfällt.' },
  { value: 'ITEM_REMINDER', label: 'Gegenstände mitbringen', hint: 'Etwa einen Tag vor einem Termin, für den du etwas aus dem Inventar hast.' },
  { value: 'CHANGE_DECIDED', label: 'Kontoänderungen', hint: 'Wenn der Vorstand über deine Änderungsanfrage entschieden hat.' },
  { value: 'TEAM', label: 'Teams', hint: 'Für Vorstand und Admins: wenn Trainer:innen jemanden ins Team aufnehmen möchten.' },
  { value: 'MESSAGE', label: 'Nachrichten vom Verein', hint: 'Nachrichten von Vorstand und Trainer:innen an dich oder dein Team.' },
  { value: 'MAIL', label: 'Neue E-Mails', hint: 'Wenn in deinem Vereins-Postfach oder einem geteilten Postfach eine E-Mail ankommt.' },
  { value: 'MEETING', label: 'Sitzungen', hint: 'Einladungen, Umlaufbeschlüsse und Erinnerungen an Fristen. Werden immer gesendet.' },
];

/** Important kinds always go out by push and e-mail (server: NotificationsApi.IMPORTANT). */
export const isImportant = (kind: NotificationKind): boolean => kind === 'MEETING';
