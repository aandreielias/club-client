// Mock of the club-server notifications module (NotificationHandlers): inbox entries from domain
// events, preferences, live announcement to the recipient. Push/e-mail delivery is not simulated.
import { directory, type MockDirectory } from '../../lib/mock/core';
import type { MockEvent } from '../../lib/mock/MockEventBus';
import { MockServer, mockServer, type MockRequest } from '../../lib/mock/MockServer';
import { MockTable } from '../../lib/mock/MockTable';
import type { Notification, NotificationKind, Preference } from './model';

const fail = MockServer.fail;
const KINDS: readonly NotificationKind[] = ['TASK_ASSIGNED', 'TASK_DUE', 'APPOINTMENT_CANCELLED', 'SECURITY'];
const MAX_LISTED = 100;

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
        const audience = event.audience ?? {};
        const recipients = audience.everyone ? this.people.activeIds() : [...(audience.members ?? [])];
        const more = data.appointmentIds.length > 1 ? ` Auch die ${data.appointmentIds.length - 1} folgenden Termine fallen aus.` : '';
        this.notify(recipients, 'APPOINTMENT_CANCELLED', `Abgesagt: ${data.title}`,
          `Der Termin am ${this.#dateTime.format(new Date(data.firstStartsAt))} findet nicht statt.${more}`,
          `/appointments/${data.appointmentIds[0]}`);
        break;
      }
      case 'members.security-changed':
        this.notify([data.memberId], 'SECURITY', SECURITY_TITLES[data.change] ?? 'Sicherheitsänderung',
          `Warst du das nicht? Melde dich sofort beim Vorstand von ${this.people.club.name}.`, '/me/security');
        break;
    }
  }

  private notify(recipients: readonly string[], kind: NotificationKind, title: string, body: string, link: string): void {
    const unique = [...new Set(recipients)];
    for (const memberId of unique) {
      const notification: Notification = { id: crypto.randomUUID(), kind, title, body, link, createdAt: new Date().toISOString(), readAt: null };
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
      id: crypto.randomUUID(), kind, title, body, link, createdAt: at(hoursAgo), readAt: read ? at(hoursAgo - 1) : null,
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
  .on('PUT', '/api/v1/me/notification-preferences', (req) => ({ items: notifications.setPreferences(me(req), req.body?.items) }));
