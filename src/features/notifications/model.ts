// Mirrors of the club-server notifications DTOs.

export type NotificationKind = 'TASK_ASSIGNED' | 'TASK_DUE' | 'APPOINTMENT_CANCELLED' | 'SECURITY' | 'CHANGE_DECIDED' | 'MESSAGE' | 'ITEM_REMINDER';

/** Records a message can link (server: NotificationsApi.RefKind). */
export type RefKind = 'TASK' | 'APPOINTMENT' | 'ITEM' | 'FILE' | 'MEMBER';

/** A linked record with its title when the message was sent; parentId: a file's folder. */
export interface MessageRef {
  kind: RefKind;
  id: string;
  title: string;
  parentId: string | null;
}

export const REF_ICONS = { TASK: 'tasks', APPOINTMENT: 'calendar', ITEM: 'inventory', FILE: 'document', MEMBER: 'account' } as const;

/** Window that opens a linked record. */
export function refWindow(ref: Pick<MessageRef, 'kind' | 'id' | 'parentId'>): { kind: string; id: string } {
  return ref.kind === 'FILE' ? { kind: 'file', id: `${ref.parentId}:${ref.id}` } : { kind: ref.kind.toLowerCase(), id: ref.id };
}

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
  { value: 'SECURITY', label: 'Sicherheit', hint: 'PIN-Änderungen und Sperren. E-Mails dazu werden immer gesendet.' },
];

/** Security e-mails cannot be switched off (server rule). */
export const isLockedEmail = (kind: NotificationKind): boolean => kind === 'SECURITY';
