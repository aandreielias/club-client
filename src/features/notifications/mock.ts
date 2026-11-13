// Mock of the club-server notifications module (NotificationHandlers): inbox entries from domain
// events, preferences, live announcement to the recipient. Push/e-mail delivery is not simulated.
import { personalData, directory, MockDirectory } from '../../lib/mock/core';
import type { MockEvent } from '../../lib/mock/MockEventBus';
import { MockServer, mockServer, type MockRequest } from '../../lib/mock/MockServer';
import { MockTable } from '../../lib/mock/MockTable';
import { isImportant, type Notification, type NotificationKind, type Preference } from './model';
import { CHANGE_FIELD_LABELS, type ChangeField } from '../members/MembersApi';

const fail = MockServer.fail;
const KINDS: readonly NotificationKind[] = [
  'TASK_ASSIGNED',
  'TASK_DUE',
  'APPOINTMENT_CANCELLED',
  'CHANGE_DECIDED',
  'ITEM_REMINDER',
  'MEETING',
  'MAIL',
  'APPOINTMENT_CHANGED',
  'ATTENDANCE',
  'RIDE',
  'TASK_ACTIVITY',
  'TEAM',
];
const MAX_LISTED = 100;

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
    if (!notification) return; // server: NotificationRepository.markRead marks nothing, no error
    notification.readAt ??= new Date().toISOString();
    this.inbox.save();
  }

  markAllRead(memberId: string): void {
    const now = new Date().toISOString();
    (this.inbox.data[memberId] ?? []).forEach((n) => (n.readAt ??= now));
    this.inbox.save();
  }

  /** server: NotificationHandlers.effective — meeting notices always on, e-mails about new mail off by default */
  effective(memberId: string): Preference[] {
    const stored = this.preferences.data[memberId] ?? [];
    return KINDS.map((kind) => {
      const pref = stored.find((p) => p.kind === kind);
      return { kind, push: isImportant(kind) || (pref?.push ?? true), email: isImportant(kind) || (pref?.email ?? kind !== 'MAIL') };
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
      case 'members.member-erased':
        // server: NotificationRepository.deleteMember
        delete this.inbox.data[data.memberId];
        delete this.preferences.data[data.memberId];
        this.inbox.save();
        this.preferences.save();
        break;
      case 'tasks.task-purged':
        // server: NotificationRepository.deleteLinkedTo
        for (const [memberId, entries] of Object.entries(this.inbox.data))
          this.inbox.data[memberId] = entries.filter((n) => n.link !== `/tasks/${data.taskId}`);
        this.inbox.save();
        break;
      case 'tasks.task-assigned':
        this.notify(
          data.memberIds,
          'TASK_ASSIGNED',
          `Neue Aufgabe: ${data.title}`,
          data.dueAt ? `Fällig: ${this.#dateTime.format(new Date(data.dueAt))}.` : 'Ohne Fälligkeit.',
          `/tasks/${data.taskId}`,
        );
        break;
      case 'calendar.appointments-changed': {
        // server: NotificationHandlers.onAppointmentsChanged — team and guardians (not the whole board), club-wide everyone
        const changed = data.change === 'UPDATED' && (data.moved || data.placeChanged);
        if (data.silent || (data.change !== 'CANCELLED' && data.change !== 'RESTORED' && !changed)) return;
        const audience = data.teamId ? { members: (event.audience?.members ?? []) as string[] } : { everyone: true };
        const recipients = this.people.audienceIds(audience).filter((id) => id !== data.actorId);
        const at = (iso: string) => this.#dateTime.format(new Date(iso));
        const link = `/appointments/${data.appointmentIds[0]}`;
        const others = data.appointmentIds.length - 1;
        if (data.change === 'CANCELLED') {
          const more = others ? ` Auch die ${others} folgenden Termine fallen aus.` : '';
          const reason = data.reason ? ` Grund: ${data.reason}` : '';
          this.notify(
            recipients,
            'APPOINTMENT_CANCELLED',
            `Abgesagt: ${data.title}`,
            `Der Termin am ${at(data.firstStartsAt)} findet nicht statt.${more}${reason}`,
            link,
          );
        } else if (data.change === 'RESTORED') {
          this.notify(
            recipients,
            'APPOINTMENT_CANCELLED',
            `Findet doch statt: ${data.title}`,
            `Der Termin am ${at(data.firstStartsAt)} findet wie geplant statt. Bitte die Zusage prüfen.`,
            link,
          );
        } else {
          const body =
            data.moved && data.previousStartsAt
              ? `Neue Zeit: ${at(data.firstStartsAt)} statt ${at(data.previousStartsAt)}.${others ? ` Auch die ${others} folgenden Termine sind verschoben.` : ''} Bitte die Zusage bestätigen.`
              : `Ort oder Kabine für ${at(data.firstStartsAt)} haben sich geändert.`;
          this.notify(recipients, 'APPOINTMENT_CHANGED', `Geändert: ${data.title}`, body, link);
        }
        break;
      }
      case 'tasks.task-notice': {
        // server: NotificationHandlers.onTaskNotice
        const title = data.kind === 'COMMENTED' ? `Neuer Kommentar: ${data.title}` : `Erledigt: ${data.title}`;
        const body = data.kind === 'COMMENTED' ? `${data.name} hat die Aufgabe kommentiert.` : `${data.name} hat die Aufgabe erledigt.`;
        this.notify(data.recipients, 'TASK_ACTIVITY', title, body, `/tasks/${data.taskId}`);
        break;
      }
      case 'teams.player-requested': {
        // server: NotificationHandlers, PLAYER_REQUESTED
        this.notify(
          data.recipients,
          'TEAM',
          `Neu ins Team: ${data.team}`,
          `${data.coach} bittet, ${data.player ?? ''} ins Team aufzunehmen. ${data.note ?? ''}`,
          `/teams/${data.teamId}`,
        );
        break;
      }
      case 'attendance.notice': {
        // server: NotificationHandlers.onAttendanceNotice
        const when = this.#dateTime.format(new Date(data.startsAt));
        const link = `/appointments/${data.appointmentId}`;
        const texts: Record<string, [NotificationKind, string, string]> = {
          OPEN_REMINDER: ['ATTENDANCE', `Noch keine Antwort: ${data.title}`, `Am ${when}. Bitte zu- oder absagen.`],
          ABSENT_AFTER_YES: [
            'ATTENDANCE',
            `Abwesend trotz Zusage: ${data.name}`,
            `${data.name} hat für „${data.title}“ am ${when} zugesagt und ist jetzt abwesend eingetragen.`,
          ],
          RIDE_JOINED: ['RIDE', `Neu in deinem Auto: ${data.name}`, `Fahrgemeinschaft zu „${data.title}“ am ${when}.`],
          RIDE_LEFT: ['RIDE', `Nicht mehr in deinem Auto: ${data.name}`, `Fahrgemeinschaft zu „${data.title}“ am ${when}.`],
          RIDE_CANCELLED: [
            'RIDE',
            `Fahrt abgesagt von ${data.name}`,
            `Die Fahrgemeinschaft zu „${data.title}“ am ${when} fällt aus. Bitte eine andere Mitfahrt suchen.`,
          ],
        };
        const [kind, title, body] = texts[data.kind as string];
        this.notify(data.recipients, kind, title, body, link);
        break;
      }
      case 'calendar.items-to-bring': {
        const items = (data.items as { name: string; quantity: number }[]).map((i) => `${i.quantity}× ${i.name}`).join(', ');
        this.notify(
          data.recipients,
          'ITEM_REMINDER',
          `Mitbringen: ${items}`,
          `Zu „${data.title}“ am ${this.#dateTime.format(new Date(data.startsAt))}. Die Sachen sind bei dir.`,
          `/appointments/${data.appointmentId}`,
        );
        break;
      }
      case 'meetings.meeting-invited': {
        const where = data.location ? ` in ${data.location}` : '';
        const video = data.videoUrl ? ` Videokonferenz: ${data.videoUrl}.` : '';
        const agenda =
          (data.agenda ? `\n\nTagesordnung:\n${data.agenda}` : '') + (data.motions?.length ? `\n\nAnträge:\n${data.motions.join('\n')}` : '');
        this.notify(
          data.recipients,
          'MEETING',
          `Einladung: ${data.title}`,
          `${this.#dateTime.format(new Date(data.startsAt))}${where}.${video}${agenda}`,
          `/meetings/${data.meetingId}`,
        );
        break;
      }
      case 'meetings.meeting-notice':
        this.notify(data.recipients, 'MEETING', data.title, data.body, data.link);
        break;
      case 'meetings.meeting-cancelled':
        this.notify(
          data.recipients,
          'MEETING',
          `Abgesagt: ${data.title}`,
          `Die Sitzung am ${this.#dateTime.format(new Date(data.startsAt))} findet nicht statt.`,
          `/meetings/${data.meetingId}`,
        );
        break;
      case 'meetings.circular-opened':
        this.notify(
          data.recipients,
          'MEETING',
          `Umlaufbeschluss: ${data.title}`,
          `${data.text ? `${data.text} ` : ''}Abstimmen bis ${this.#dateTime.format(new Date(data.deadline))}.`,
          `/resolutions/${data.resolutionId}`,
        );
        break;
      case 'mail.mail-received':
        this.notify(
          this.people.audienceIds(event.audience ?? {}),
          'MAIL',
          `Neue E-Mail von ${data.fromName}`,
          data.subject,
          `/mail/${data.mailboxId}/${data.mailId}`,
        );
        break;
      case 'members.change-decided':
        this.notify(
          [data.memberId],
          'CHANGE_DECIDED',
          `${data.approved ? 'Änderung übernommen' : 'Änderung abgelehnt'}: ${CHANGE_FIELD_LABELS[data.field as ChangeField]}`,
          data.approved ? 'Deine Kontodaten wurden geändert.' : 'Melde dich beim Vorstand, wenn du Fragen dazu hast.',
          '/account',
        );
        break;
    }
  }

  private notify(recipients: readonly string[], kind: NotificationKind, title: string, body: string, link: string | null): void {
    const unique = [...new Set(recipients)];
    for (const memberId of unique) {
      const notification: Notification = {
        id: crypto.randomUUID(),
        kind,
        title,
        body,
        link,
        createdAt: new Date().toISOString(),
        readAt: null,
      };
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
      id: crypto.randomUUID(),
      kind,
      title,
      body,
      link,
      createdAt: at(hoursAgo),
      readAt: read ? at(hoursAgo - 1) : null,
    });
    return {
      spielerin: [
        entry('TASK_DUE', 'Bald fällig: Trikots waschen', 'Fällig in weniger als einem Tag.', '/tasks/t-1', 2, false),
        entry('TASK_ASSIGNED', 'Neue Aufgabe: Fahrgemeinschaft Auswärtsspiel', 'Fällig in einer Woche.', '/tasks/t-2', 120, true),
      ],
      spieler: [entry('TASK_ASSIGNED', 'Neue Aufgabe: Bälle aufpumpen', 'Fällig gestern.', '/tasks/t-3', 48, false)],
    };
  }
}

export const notifications = new MockNotifications(directory);
// server: NotificationRepository.personalData
personalData.set('notifications', (memberId) => ({
  inbox: (notifications.inbox.data[memberId] ?? []).map(({ kind, title, body, link, createdAt, readAt }) => ({
    kind,
    title,
    body,
    link,
    createdAt,
    readAt,
  })),
  preferences: notifications.preferences.data[memberId] ?? [],
}));

const me = (req: MockRequest) => directory.actor(req).id;

mockServer
  .on('GET', '/api/v1/me/notifications', (req) => notifications.list(me(req), req.query.get('unreadOnly') === 'true'))
  .on('POST', '/api/v1/me/notifications/read-all', (req) => notifications.markAllRead(me(req)))
  .on('PATCH', '/api/v1/me/notifications/:id', (req) => {
    if (req.body?.read !== true) MockServer.fail(400, 'request.invalid'); // server: ReadBody, only true
    return notifications.markRead(me(req), req.params.id);
  })
  .on('GET', '/api/v1/me/notification-preferences', (req) => ({ items: notifications.effective(me(req)) }))
  .on('PUT', '/api/v1/me/notification-preferences', (req) => ({ items: notifications.setPreferences(me(req), req.body?.items) }));
