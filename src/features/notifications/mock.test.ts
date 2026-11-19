import { describe, expect, it, vi } from 'vitest';
import { directory } from '../../lib/mock/core';
import { MockSocket } from '../../lib/mock/MockSocket';
import { mockServer } from '../../lib/mock/MockServer';
import type { Member } from '../../lib/types';
import { calendar } from '../calendar/mock';
import { tasks } from '../tasks/mock';
import { notifications } from './mock';

const member = (id: string): Member => directory.members.data.find((m) => m.id === id)!;
const cancelledTitles = (id: string) =>
  notifications
    .list(id, false)
    .items.filter((n) => n.kind === 'APPOINTMENT_CANCELLED')
    .map((n) => n.title);
const upcoming = (teamId: string | null) =>
  calendar.appointments.data.find((a) => a.teamId === teamId && !a.cancelled && Date.parse(a.startsAt) > Date.now())!;

/** Opens a mock live connection for a member and collects the pushed messages. */
async function connect(id: string) {
  const received: { type: string; data: any }[] = [];
  const socket = new MockSocket(mockServer.events, (email) => directory.findActive(email), 60_000);
  socket.onmessage = (event) => received.push(JSON.parse(event.data));
  socket.send(JSON.stringify({ type: 'auth', token: `dev:${id}@example.at` }));
  await vi.waitFor(() => expect(received[0]?.type).toBe('auth.ok'));
  return { received, socket };
}

describe('mock notifications', () => {
  it('creates an inbox entry for newly assigned members and announces it live', async () => {
    const { received, socket } = await connect('spieler');
    tasks.create(member('trainer'), {
      teamId: 't-u16',
      appointmentId: null,
      title: 'Netze prüfen',
      description: null,
      dueAt: null,
      assignees: ['spieler'],
      checklist: [],
      repeatWeeks: null,
      repeatMonths: null,
      repeatByWeekday: false,
    });
    expect(notifications.list('spieler', true).items[0]).toMatchObject({
      kind: 'TASK_ASSIGNED',
      title: 'Neue Aufgabe: Netze prüfen',
      link: expect.stringMatching(/^\/tasks\//),
    });
    await vi.waitFor(() => expect(received.map((m) => m.type)).toContain('notifications.notification-created'));
    expect(received.map((m) => m.type)).toContain('tasks.task-changed');
    socket.close();
  });

  it('only delivers events to their audience', async () => {
    const { received, socket } = await connect('spielerin');
    mockServer.events.publish({ type: 'x.private', data: {}, audience: { members: ['spieler'] } });
    mockServer.events.publish({ type: 'x.internal', data: {} });
    mockServer.events.publish({ type: 'x.everyone', data: {}, audience: { everyone: true } });
    await vi.waitFor(() => expect(received.map((m) => m.type)).toEqual(['auth.ok', 'x.everyone']));
    socket.close();
  });

  it('refuses unknown members with 4403', async () => {
    const socket = new MockSocket(mockServer.events, (email) => directory.findActive(email), 60_000);
    const closed = new Promise<number>((resolve) => (socket.onclose = (e) => resolve(e.code)));
    socket.send(JSON.stringify({ type: 'auth', token: 'dev:nobody@example.at' }));
    expect(await closed).toBe(4403);
  });

  it('tells the team and its guardians when an admin cancels a team appointment, not the whole board, nor the admin', () => {
    const target = upcoming('t-u16');
    calendar.cancel(member('admin'), target.id, false);
    const title = `Abgesagt: ${target.title}`;
    for (const id of [...directory.teamMembers('t-u16'), 'eltern'].filter((id) => id !== 'admin')) expect(cancelledTitles(id), id).toContain(title);
    if (!directory.teamMembers('t-u16').includes('vorstand')) expect(cancelledTitles('vorstand')).not.toContain(title);
    expect(cancelledTitles('admin')).not.toContain(title);
    expect(cancelledTitles('spielerin')).not.toContain(title);
  });

  it('tells every active member when a club-wide appointment is cancelled', () => {
    const target = upcoming(null);
    calendar.cancel(member('vorstand'), target.id, false);
    const title = `Abgesagt: ${target.title}`;
    for (const id of directory.activeIds().filter((id) => id !== 'vorstand')) expect(cancelledTitles(id), id).toContain(title);
  });
});

describe('mock notification rules', () => {
  it('lets the board set important kinds and defaults; the member choice wins, important kinds stay on', () => {
    const body = {
      importantKinds: ['FEE'],
      defaults: [{ kind: 'TASK_DUE', push: false, email: true }],
      inboxRetentionDays: 60,
      activityRetentionDays: 365,
    } as const;
    expect(() => notifications.saveSettings(member('spieler'), structuredClone(body) as any)).toThrow();
    expect(() => notifications.saveSettings(member('vorstand'), { ...structuredClone(body), inboxRetentionDays: 10 } as any)).toThrow();
    const before = structuredClone(notifications.settings.data);
    try {
      notifications.saveSettings(member('vorstand'), structuredClone(body) as any);
      notifications.setPreferences('spieler', [{ kind: 'FEE', push: false, email: false }]);
      const prefs = notifications.effective('spieler');
      expect(prefs.find((p) => p.kind === 'FEE')).toEqual({ kind: 'FEE', push: true, email: true });
      expect(prefs.find((p) => p.kind === 'TASK_DUE')).toEqual({ kind: 'TASK_DUE', push: false, email: true });
      expect(prefs.find((p) => p.kind === 'MEETING')).toEqual({ kind: 'MEETING', push: true, email: true });
    } finally {
      Object.assign(notifications.settings.data, before);
      notifications.setPreferences('spieler', []);
    }
  });
});
