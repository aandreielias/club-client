import { describe, expect, it, vi } from 'vitest';
import { directory, MockDirectory } from '../../lib/mock/core';
import { MockSocket } from '../../lib/mock/MockSocket';
import { mockServer } from '../../lib/mock/MockServer';
import type { Member } from '../../lib/types';
import { tasks } from '../tasks/mock';
import { notifications } from './mock';

const member = (id: string): Member => directory.members.data.find((m) => m.id === id)!;

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
      teamId: 't-u16', appointmentId: null, title: 'Netze prüfen', description: null, dueAt: null, assignees: ['spieler'], checklist: [],
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

  it('reports security changes and keeps security e-mails on', () => {
    directory.setPin(member('spielerin'), 'k7m2q', undefined);
    expect(notifications.list('spielerin', true).items[0]).toMatchObject({ kind: 'SECURITY', link: '/me/security' });
    const prefs = notifications.setPreferences('spielerin', [{ kind: 'SECURITY', push: false, email: false }]);
    expect(prefs.find((p) => p.kind === 'SECURITY')).toEqual({ kind: 'SECURITY', push: false, email: true });
  });
});
