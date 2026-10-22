import { describe, expect, it, vi } from 'vitest';
import { directory, MockDirectory } from '../../lib/mock/core';
import { MockSocket } from '../../lib/mock/MockSocket';
import { mockServer } from '../../lib/mock/MockServer';
import type { Member } from '../../lib/types';
import { calendar } from '../calendar/mock';
import { tasks } from '../tasks/mock';
import { notifications } from './mock';

const member = (id: string): Member => directory.members.data.find((m) => m.id === id)!;
const cancelledTitles = (id: string) => notifications.list(id, false).items.filter((n) => n.kind === 'APPOINTMENT_CANCELLED').map((n) => n.title);
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
    directory.stepUp(member('trainer'), MockDirectory.PIN);
    tasks.create(member('trainer'), {
      teamId: 't-u16', appointmentId: null, title: 'Netze prüfen', description: null, dueAt: null, assignees: ['spieler'], checklist: [], repeatWeeks: null,
    });
    expect(notifications.list('spieler', true).items[0]).toMatchObject({ kind: 'TASK_ASSIGNED', title: 'Neue Aufgabe: Netze prüfen', link: expect.stringMatching(/^\/tasks\//) });
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

  it('tells the other privileged members when the club PIN changes and keeps security messages on', () => {
    directory.stepUp(member('admin'), MockDirectory.PIN);
    directory.setClubPin(member('admin'), 'k7m2q');
    directory.setClubPin(member('admin'), MockDirectory.PIN);
    const changed = (id: string) => notifications.list(id, true).items.filter((n) => n.title === 'Der Vereins-PIN wurde geändert');
    for (const id of ['vorstand', 'trainer']) {
      expect(changed(id)[0], id).toMatchObject({
        kind: 'SECURITY', link: '/me/security', body: 'Frag beim Vorstand nach dem neuen PIN. Wusstest du nichts davon? Melde dich beim Vorstand.',
      });
    }
    expect(changed('admin')).toEqual([]);
    expect(changed('spielerin')).toEqual([]);
    const prefs = notifications.setPreferences('vorstand', [{ kind: 'SECURITY', push: false, email: false }]);
    expect(prefs.find((p) => p.kind === 'SECURITY')).toEqual({ kind: 'SECURITY', push: true, email: true }); // important: always sent
  });

  it('tells everyone affected when an admin cancels a team appointment, admin and board included, but not the admin', () => {
    directory.stepUp(member('admin'), MockDirectory.PIN);
    const target = upcoming('t-u16');
    calendar.cancel(member('admin'), target.id, false);
    const title = `Abgesagt: ${target.title}`;
    for (const id of [...directory.teamMembers('t-u16'), 'eltern', 'vorstand']) expect(cancelledTitles(id), id).toContain(title);
    expect(cancelledTitles('admin')).not.toContain(title);
    expect(cancelledTitles('spielerin')).not.toContain(title);
  });

  it('tells every active member when a club-wide appointment is cancelled', () => {
    directory.stepUp(member('vorstand'), MockDirectory.PIN);
    const target = upcoming(null);
    calendar.cancel(member('vorstand'), target.id, false);
    const title = `Abgesagt: ${target.title}`;
    for (const id of directory.activeIds().filter((id) => id !== 'vorstand')) expect(cancelledTitles(id), id).toContain(title);
  });

  it('sends messages: coaches only to their teams, guardians read along, linked records as the sender sees them', () => {
    directory.stepUp(member('trainer'), MockDirectory.PIN);
    const appointment = upcoming('t-u16');
    const body = { title: 'Hallenwechsel', body: 'Samstag Südhalle.\nPünktlich!', teamIds: ['t-u16'], refs: [{ kind: 'APPOINTMENT', id: appointment.id }] };
    const reach = notifications.send(member('trainer'), body, true).recipients;
    expect(notifications.send(member('trainer'), body, false).recipients).toBe(reach);
    for (const id of ['spieler', 'eltern']) {
      expect(notifications.list(id, true).items[0]).toMatchObject({
        kind: 'MESSAGE', senderId: 'trainer', body: 'Samstag Südhalle.\nPünktlich!', refs: [{ kind: 'APPOINTMENT', id: appointment.id, title: appointment.title }],
      });
    }
    expect(() => notifications.send(member('trainer'), { title: 'x', everyone: true }, false)).toThrow(expect.objectContaining({ status: 403 }));
    expect(() => notifications.send(member('trainer'), { ...body, refs: [{ kind: 'TASK', id: 'nope' }] }, false))
      .toThrow(expect.objectContaining({ code: 'message.ref-unknown' }));
    expect(() => notifications.send(member('spieler'), body, true)).toThrow(expect.objectContaining({ status: 403 }));
  });
});
