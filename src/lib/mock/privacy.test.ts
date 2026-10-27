import { describe, expect, it } from 'vitest';
import type { Member } from '../types';
import '../../features/calendar/mock';
import '../../features/tasks/mock';
import '../../features/notifications/mock';
import '../../features/members/mock';
import '../../features/teams/mock';
import { directory } from './core';
import { mockServer } from './MockServer';

const member = (id: string): Member => directory.members.data.find((m) => m.id === id)!;
const as = (id: string) => `${id}@example.at`;

describe('mock access requests and audit log', () => {
  it("exports own and wards' data, nobody else's", () => {
    const own = mockServer.handle('GET', '/api/v1/me/export', undefined, as('spieler')) as { data: Record<string, Record<string, unknown[]>> };
    expect(own.data.members.profile).toHaveLength(1);
    expect(Object.keys(own.data)).toEqual(expect.arrayContaining(['members', 'attendance', 'calendar', 'tasks', 'notifications']));
    expect(mockServer.handle('GET', '/api/v1/me/export?memberId=spieler', undefined, as('eltern'))).toMatchObject({ memberId: 'spieler' });
    expect(() => mockServer.handle('GET', '/api/v1/me/export?memberId=spieler', undefined, as('trainer'))).toThrow(
      expect.objectContaining({ status: 404 }),
    );
  });

  it('logs privileged writes and member reads for admins only', () => {
    directory.confirm(member('admin'));
    mockServer.handle('PUT', '/api/v1/members/spieler/roles', { roles: ['PLAYER', 'VOLUNTEER'] }, as('admin'));
    mockServer.handle('GET', '/api/v1/members/spieler', undefined, as('vorstand'));
    mockServer.handle('GET', '/api/v1/teams', undefined, as('spieler'));
    const log = mockServer.handle('GET', '/api/v1/audit', undefined, as('admin')) as { items: { route: string; params: Record<string, string> }[] };
    expect(log.items.map((e) => e.route).slice(0, 2)).toEqual(['/api/v1/members/{id}', '/api/v1/members/{id}/roles']);
    expect(log.items[1].params.id).toBe('spieler');
    expect(() => mockServer.handle('GET', '/api/v1/audit', undefined, as('vorstand'))).toThrow(expect.objectContaining({ code: 'access.denied' }));
  });
});

describe('mock minors rules', () => {
  it('lets a 16-year-old decide about photos, not the guardian', () => {
    expect(() => mockServer.handle('PATCH', '/api/v1/members/spieler', { photoConsent: true }, as('eltern'))).toThrow(
      expect.objectContaining({ code: 'member.consent-own' }),
    );
    expect(mockServer.handle('PATCH', '/api/v1/members/spieler', { photoConsent: true }, as('spieler'))).toMatchObject({ photoConsent: true });
  });
});

describe('mock audit filters', () => {
  it('filter by kind, area and person', () => {
    directory.confirm(member('admin'));
    mockServer.handle('PUT', '/api/v1/members/spieler/roles', { roles: ['PLAYER'] }, as('admin'));
    mockServer.handle('GET', '/api/v1/members/spieler', undefined, as('vorstand'));
    const list = (q: string) =>
      (mockServer.handle('GET', `/api/v1/audit?${q}`, undefined, as('admin')) as { items: { method: string; actorId: string }[] }).items;
    expect(list('kind=WRITE').every((e) => e.method !== 'GET')).toBe(true);
    expect(list('kind=READ').every((e) => e.method === 'GET')).toBe(true);
    expect(list('actorId=vorstand').every((e) => e.actorId === 'vorstand')).toBe(true);
    expect(list('area=teams')).toEqual([]);
    expect(() => list('area=../x')).toThrow(expect.objectContaining({ code: 'audit.area-invalid' }));
  });
});
