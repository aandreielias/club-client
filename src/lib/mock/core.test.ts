import { describe, expect, it } from 'vitest';
import { directory, MockDirectory } from './core';
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
    expect(() => mockServer.handle('POST', '/api/v1/me/step-up', { pin: MockDirectory.PIN }, as('neu'))).toThrow(
      expect.objectContaining({ code: 'profile.birth-date-required' }),
    );
    mockServer.handle('PATCH', '/api/v1/members/neu', { birthDate: '2000-05-05' }, as('neu'));
    expect(mockServer.handle('GET', '/api/v1/me', undefined, as('neu'))).toMatchObject({ missing: [] });
  });

  it('checks PIN rules and grants a step-up', () => {
    const trainer = as('trainer');
    expect(() => mockServer.handle('POST', '/api/v1/me/step-up', { pin: 'wrong' }, trainer)).toThrow(
      expect.objectContaining({ code: 'auth.pin-wrong' }),
    );
    expect(mockServer.handle('POST', '/api/v1/me/step-up', { pin: MockDirectory.PIN }, trainer)).toMatchObject({ until: expect.any(String) });
    expect(() => mockServer.handle('PUT', '/api/v1/me/pin', { currentPin: MockDirectory.PIN, newPin: '12345' }, trainer)).toThrow(
      expect.objectContaining({ code: 'auth.pin-too-simple' }),
    );
  });

  it('sees the teams of wards', () => {
    expect([...directory.visibleTeamIds('eltern')]).toEqual(['t-u16']);
  });
});
