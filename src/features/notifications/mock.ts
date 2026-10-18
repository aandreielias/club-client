// Mock of the club-server notifications module (NotificationHandlers): inbox entries from domain
// events, preferences, live announcement to the recipient. Push/e-mail delivery is not simulated.
import { directory, type MockDirectory } from '../../lib/mock/core';
import type { MockEvent } from '../../lib/mock/MockEventBus';
import { MockServer, mockServer, type MockRequest } from '../../lib/mock/MockServer';
import { MockTable } from '../../lib/mock/MockTable';
import type { MessageRef, Notification, NotificationKind, Preference, RefKind } from './model';
import { PRIVILEGED, type Member } from '../../lib/types';
import { settings } from '../../settings';
import { calendar } from '../calendar/mock';
import { files } from '../files/mock';
import { inventory } from '../inventory/mock';
import { tasks } from '../tasks/mock';
import { CHANGE_FIELD_LABELS, type ChangeField } from '../members/MembersApi';

const fail = MockServer.fail;
const KINDS: readonly NotificationKind[] = ['TASK_ASSIGNED', 'TASK_DUE', 'APPOINTMENT_CANCELLED', 'SECURITY', 'CHANGE_DECIDED'];
const MAX_LISTED = 100;
const limits = settings.notifications.message;

const SECURITY_TITLES: Record<string, string> = {
  PIN_SET: 'Deine PIN wurde eingerichtet',
  PIN_CHANGED: 'Deine PIN wurde geändert',
  PIN_LOCKED: 'Deine PIN wurde nach 5 Fehlversuchen gesperrt',
  RESET_BY_ADMIN: 'Deine PIN wurde von einem Admin zurückgesetzt',
  DEVICE_ADDED: 'Neues Gerät für Face ID / Fingerabdruck hinzugefügt',
};

export class MockNotifications {
  /** memberId → inbox, newest first */
  readonly inbox: MockTable<Record<string, Notification[]>>;
  /** memberId → stored preferences (missing kinds = all channels on) */
  readonly preferences = new MockTable<Record<string, Preference[]>>('notification-preferences', () => ({}));

  readonly #dateTime: Intl.DateTimeFormat;

  constructor(private readonly people: MockDirectory) {
    this.#dateTime = new Intl.DateTimeFormat(people.club.locale, { timeZone: people.club.timeZone, dateStyle: 'medium', timeStyle: 'short' });
    this.inbox = new MockTable('notifications', () => this.seed());
    mockServer.events.subscribe((event) => this.onEvent(event));
  }

  list(memberId: string, unreadOnly: boolean): { items: Notification[]; unread: number } {
    const all = this.inbox.data[memberId] ?? [];
    return {
      items: all.filter((n) => !unreadOnly || !n.readAt).slice(0, MAX_LISTED),
      unread: all.filter((n) => !n.readAt).length,
    };
  }

  markRead(memberId: string, id: string): void {
    const notification = (this.inbox.data[memberId] ?? []).find((n) => n.id === id);
    if (!notification) return fail(404, 'not-found');
    notification.readAt ??= new Date().toISOString();
    this.inbox.save();
  }

  markAllRead(memberId: string): void {
    const now = new Date().toISOString();
    (this.inbox.data[memberId] ?? []).forEach((n) => (n.readAt ??= now));
    this.inbox.save();
  }

  /** server: NotificationHandlers.effective — security e-mails always on */
  effective(memberId: string): Preference[] {
    const stored = this.preferences.data[memberId] ?? [];
    return KINDS.map((kind) => {
      const pref = stored.find((p) => p.kind === kind);
      return { kind, push: pref?.push ?? true, email: kind === 'SECURITY' || (pref?.email ?? true) };
    });
  }

  setPreferences(memberId: string, items: unknown): Preference[] {
    if (!Array.isArray(items)) return fail(400, 'notifications.preferences-missing');
    for (const item of items) if (!KINDS.includes(item?.kind)) fail(400, 'notifications.kind-missing');
    this.preferences.data[memberId] = items.map((p) => ({ kind: p.kind, push: !!p.push, email: !!p.email }));
    this.preferences.save();
    return this.effective(memberId);
  }

  /** server: MessageHandlers.send; `preview` only counts. */
  send(viewer: Member, body: Record<string, any>, preview: boolean): { recipients: number } {
    if (preview) this.people.requireRole(viewer, PRIVILEGED);
    else this.people.requirePrivileged(viewer, PRIVILEGED);
    const recipients = this.recipients(viewer, body);
    if (preview) return { recipients: recipients.length };
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const text = typeof body.body === 'string' ? body.body.trim() : '';
    if (!title || title.length > limits.titleMaxLength) fail(400, 'message.title-invalid');
    if (text.length > limits.bodyMaxLength) fail(400, 'message.body-too-long');
    if (!recipients.length) fail(400, 'message.recipients-missing');
    const inputs: { kind: RefKind; id: string }[] = Array.isArray(body.refs) ? body.refs : [];
    if (inputs.length > limits.maxRefs) fail(400, 'message.too-many-refs');
    const refs = inputs.map((ref) => this.ref(viewer, ref));
    this.notify(recipients, 'MESSAGE', title, text.replace(/\n{3,}/g, '\n\n'), null, { senderId: viewer.id, senderName: `${viewer.firstName} ${viewer.lastName}`, refs });
    return { recipients: recipients.length };
  }

  private recipients(viewer: Member, body: Record<string, any>): string[] {
    const manager = this.people.isManager(viewer);
    const teamIds: string[] = body.teamIds ?? [];
    const memberIds: string[] = body.memberIds ?? [];
    if (teamIds.length + memberIds.length > limits.maxTargets) fail(400, 'message.too-many-targets');
    const recipients = new Set<string>();
    if (body.everyone) {
      if (!manager) fail(403, 'access.denied');
      this.people.audienceIds({ everyone: true }).forEach((id) => recipients.add(id));
    } else {
      const coached = Object.entries(this.people.teamRoles(viewer.id)).filter(([, role]) => role === 'COACH').map(([team]) => team);
      for (const teamId of teamIds) {
        if (!manager && !coached.includes(teamId)) fail(403, 'access.denied');
        this.people.teamMembers(teamId).forEach((id) => recipients.add(id));
      }
      if (!manager && !memberIds.every((id) => coached.some((team) => this.people.teamMembers(team).includes(id)))) fail(403, 'access.denied');
      if (memberIds.some((id) => !this.people.activeIds().includes(id))) fail(400, 'message.member-unknown');
      memberIds.forEach((id) => recipients.add(id));
    }
    if (body.includeGuardians !== false) this.people.guardiansOf([...recipients]).forEach((id) => recipients.add(id));
    recipients.delete(viewer.id);
    return [...recipients];
  }

  /** The record as the sender sees it (server: MessageHandlers.resolve). */
  private ref(viewer: Member, ref: { kind: RefKind; id: string }): MessageRef {
    try {
      switch (ref.kind) {
        case 'TASK':
          return { ...ref, title: tasks.get(viewer, ref.id).title, parentId: null };
        case 'APPOINTMENT':
          return { ...ref, title: calendar.visible(viewer, ref.id).title, parentId: null };
        case 'ITEM':
          this.people.requireRole(viewer, PRIVILEGED);
          return { ...ref, title: inventory.get(ref.id).name, parentId: null };
        case 'MEMBER': {
          const m = this.people.get(viewer, ref.id);
          return { ...ref, title: `${m.firstName} ${m.lastName}`, parentId: null };
        }
        case 'FILE': {
          const f = files.refs(viewer, [{ fileId: ref.id, folderId: null, name: null }]).find((r) => !r.deleted);
          if (f) return { ...ref, title: f.name, parentId: f.folderId };
        }
      }
    } catch {
      // not visible: refused below
    }
    return fail(400, 'message.ref-unknown');
  }

  /** server: NotificationHandlers.on* */
  private onEvent(event: MockEvent): void {
    const data = event.data as Record<string, any>;
    switch (event.type) {
      case 'tasks.task-assigned':
        this.notify(data.memberIds, 'TASK_ASSIGNED', `Neue Aufgabe: ${data.title}`,
          data.dueAt ? `Fällig: ${this.#dateTime.format(new Date(data.dueAt))}.` : 'Ohne Fälligkeit.', `/tasks/${data.taskId}`);
        break;
      case 'calendar.appointments-changed': {
        if (data.change !== 'CANCELLED') return;
        const recipients = this.people.audienceIds(event.audience ?? {}).filter((id) => id !== data.actorId);
        const more = data.appointmentIds.length > 1 ? ` Auch die ${data.appointmentIds.length - 1} folgenden Termine fallen aus.` : '';
        this.notify(recipients, 'APPOINTMENT_CANCELLED', `Abgesagt: ${data.title}`,
          `Der Termin am ${this.#dateTime.format(new Date(data.firstStartsAt))} findet nicht statt.${more}`,
          `/appointments/${data.appointmentIds[0]}`);
        break;
      }
      case 'members.change-decided':
        this.notify([data.memberId], 'CHANGE_DECIDED', `${data.approved ? 'Änderung übernommen' : 'Änderung abgelehnt'}: ${CHANGE_FIELD_LABELS[data.field as ChangeField]}`,
          data.approved ? 'Deine Kontodaten wurden geändert.' : 'Melde dich beim Vorstand, wenn du Fragen dazu hast.', '/account');
        break;
      case 'members.security-changed':
        this.notify([data.memberId], 'SECURITY', SECURITY_TITLES[data.change] ?? 'Sicherheitsänderung',
          `Warst du das nicht? Melde dich sofort beim Vorstand von ${this.people.club.name}.`, '/me/security');
        break;
    }
  }

  private notify(recipients: readonly string[], kind: NotificationKind, title: string, body: string, link: string | null,
    message: Pick<Notification, 'senderId' | 'senderName' | 'refs'> = { senderId: null, senderName: null, refs: [] }): void {
    const unique = [...new Set(recipients)];
    for (const memberId of unique) {
      const notification: Notification = { id: crypto.randomUUID(), kind, title, body, link, createdAt: new Date().toISOString(), readAt: null, ...message };
      (this.inbox.data[memberId] ??= []).unshift(notification);
      mockServer.events.publish({
        type: 'notifications.notification-created',
        data: { notificationId: notification.id, kind, title },
        audience: { members: [memberId] },
      });
    }
    if (unique.length) this.inbox.save();
  }

  private seed(): Record<string, Notification[]> {
    const at = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
    const entry = (kind: NotificationKind, title: string, body: string, link: string, hoursAgo: number, read: boolean): Notification => ({
      id: crypto.randomUUID(), kind, title, body, link, createdAt: at(hoursAgo), readAt: read ? at(hoursAgo - 1) : null, senderId: null, senderName: null, refs: [],
    });
    return {
      spielerin: [
        entry('TASK_DUE', 'Bald fällig: Trikots waschen', 'Fällig in weniger als einem Tag.', '/tasks/t-1', 2, false),
        entry('TASK_ASSIGNED', 'Neue Aufgabe: Fahrgemeinschaft Auswärtsspiel', 'Fällig in einer Woche.', '/tasks/t-2', 120, true),
      ],
      spieler: [entry('TASK_ASSIGNED', 'Neue Aufgabe: Bälle aufpumpen', 'Fällig gestern.', '/tasks/t-3', 48, false)],
      trainer: [entry('SECURITY', 'Deine PIN wurde eingerichtet', `Warst du das nicht? Melde dich sofort beim Vorstand von ${this.people.club.name}.`, '/me/security', 200, true)],
    };
  }
}

export const notifications = new MockNotifications(directory);

const me = (req: MockRequest) => directory.actor(req).id;

mockServer
  .on('GET', '/api/v1/me/notifications', (req) => notifications.list(me(req), req.query.get('unreadOnly') === 'true'))
  .on('POST', '/api/v1/me/notifications/read-all', (req) => notifications.markAllRead(me(req)))
  .on('POST', '/api/v1/me/notifications/:id/read', (req) => notifications.markRead(me(req), req.params.id))
  .on('GET', '/api/v1/me/notification-preferences', (req) => ({ items: notifications.effective(me(req)) }))
  .on('POST', '/api/v1/notifications/messages', (req) => notifications.send(directory.actor(req), req.body ?? {}, false))
  .on('POST', '/api/v1/notifications/messages/preview', (req) => notifications.send(directory.actor(req), req.body ?? {}, true))
  .on('PUT', '/api/v1/me/notification-preferences', (req) => ({ items: notifications.setPreferences(me(req), req.body?.items) }));
