import { describe, expect, it } from 'vitest';
import type { Member } from '../types';
import { calendar } from '../../features/calendar/mock';
import { changeRequests } from '../../features/members/mock';
import { tasks } from '../../features/tasks/mock';
import { notifications } from '../../features/notifications/mock';
import { directory } from './core';
import { mockServer } from './MockServer';

const member = (id: string): Member => directory.members.data.find((m) => m.id === id)!;

describe('mock GDPR erasure', () => {
  it('drops what every module keeps about the member, like the server', () => {
    const player = member('spieler');
    changeRequests.request(player, { field: 'FIRST_NAME', value: 'Davidneu' });
    calendar.addAbsence(player, { from: '2026-11-01', to: '2026-11-02', reason: 'krank' });
    calendar.feeds.data[player.id] = 'token';
    const requestTask = tasks.tasks.data.find((t) => t.title.includes('David Spieler'));
    expect(requestTask).toBeDefined();

    directory.confirm(member('admin'));
    mockServer.handle('POST', `/api/v1/members/${player.id}/deactivate`, undefined, 'admin@example.at');
    mockServer.handle('POST', `/api/v1/members/${player.id}/erase`, undefined, 'admin@example.at');

    expect(changeRequests.requests.data.some((r) => r.memberId === player.id)).toBe(false);
    expect(calendar.absences.data.some((a) => a.memberId === player.id)).toBe(false);
    expect(calendar.feeds.data[player.id]).toBeUndefined();
    expect(Object.values(calendar.responses.data).some((answers) => player.id in answers)).toBe(false);
    expect(calendar.rides.data.some((r) => r.driverId === player.id || r.passengers.includes(player.id))).toBe(false);
    expect(tasks.tasks.data.some((t) => t.id === requestTask!.id || t.assignees.includes(player.id))).toBe(false);
    expect(notifications.inbox.data[player.id]).toBeUndefined();
    expect(Object.values(notifications.inbox.data).flat().some((n) => n.link === `/tasks/${requestTask!.id}`)).toBe(false);
  });
});
