import { describe, expect, it } from 'vitest';
import { directory } from './core';
import { mockServer } from './MockServer';

const as = (id: string) => `${id}@example.at`;

describe('mock core', () => {
  it('serves club facts and 404s unknown routes', () => {
    expect(mockServer.handle('GET', '/api/v1/club', undefined, null)).toMatchObject({ timeZone: 'Europe/Vienna' });
    expect(() => mockServer.handle('GET', '/api/v1/nope', undefined, null)).toThrow(expect.objectContaining({ status: 404 }));
  });

  it('needs a login for /me', () => {
    expect(() => mockServer.handle('GET', '/api/v1/me', undefined, null)).toThrow(expect.objectContaining({ status: 401 }));
  });

  it('lists missing profile fields and blocks other calls until done', () => {
    expect(mockServer.handle('GET', '/api/v1/me', undefined, as('neu'))).toMatchObject({ missing: ['birthDate'] });
    expect(() => mockServer.handle('GET', '/api/v1/teams', undefined, as('neu'))).toThrow(
      expect.objectContaining({ code: 'profile.birth-date-required' }),
    );
    mockServer.handle('PATCH', '/api/v1/members/neu', { birthDate: '2000-05-05' }, as('neu'));
    expect(mockServer.handle('GET', '/api/v1/me', undefined, as('neu'))).toMatchObject({ missing: [] });
  });

  it('lets privileged members change club data with their role alone', () => {
    const trainer = directory.members.data.find((m) => m.id === 'trainer')!;
    expect(() => directory.requirePrivileged(trainer)).not.toThrow();
    const player = directory.members.data.find((m) => m.id === 'spieler')!;
    expect(() => directory.requirePrivileged(player)).toThrow(expect.objectContaining({ code: 'access.denied' }));
  });

  it('sees the teams of wards', () => {
    expect([...directory.visibleTeamIds('eltern')]).toEqual(['t-u16']);
  });
});
