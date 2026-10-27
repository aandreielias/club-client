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

  it('checks the club PIN and grants a step-up', () => {
    const trainer = as('trainer');
    expect(() => mockServer.handle('POST', '/api/v1/me/step-up', { pin: 'wrong' }, trainer)).toThrow(
      expect.objectContaining({ code: 'auth.pin-wrong' }),
    );
    expect(mockServer.handle('POST', '/api/v1/me/step-up', { pin: MockDirectory.PIN }, trainer)).toMatchObject({ until: expect.any(String) });
    expect(mockServer.handle('GET', '/api/v1/me/security', undefined, trainer)).toMatchObject({
      clubPinSet: true,
      pinLocked: false,
      stepUpUntil: expect.any(String),
    });
  });

  it('lets admin and board confirm only with their authenticator app', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(mockServer.handle('GET', '/api/v1/me/security', undefined, as('vorstand'))).toMatchObject({ mfaRequired: true });
    expect(() => mockServer.handle('POST', '/api/v1/me/step-up', { pin: MockDirectory.PIN }, as('vorstand'))).toThrow(
      expect.objectContaining({ code: 'auth.mfa-required' }),
    );
    expect(() => mockServer.handle('POST', '/api/v1/me/step-up/mfa', undefined, as('vorstand'))).toThrow(
      expect.objectContaining({ code: 'auth.mfa-not-recent' }),
    );
    expect(() => mockServer.handle('POST', '/api/v1/me/step-up/mfa', undefined, as('vorstand'), undefined, now - 600)).toThrow(
      expect.objectContaining({ code: 'auth.mfa-not-recent' }),
    );
    expect(mockServer.handle('POST', '/api/v1/me/step-up/mfa', undefined, as('vorstand'), undefined, now)).toMatchObject({
      until: expect.any(String),
    });
  });

  it('lets only admin and board change the club PIN, always with a step-up', () => {
    expect(() => mockServer.handle('PUT', '/api/v1/club/pin', { pin: 'k7m2q' }, as('trainer'))).toThrow(
      expect.objectContaining({ code: 'access.denied' }),
    );
    expect(() => mockServer.handle('PUT', '/api/v1/club/pin', { pin: 'k7m2q' }, as('admin'))).toThrow(
      expect.objectContaining({ code: 'auth.step-up-required' }),
    );
    directory.confirm(directory.members.data.find((m) => m.id === 'vorstand')!);
    expect(() => mockServer.handle('PUT', '/api/v1/club/pin', { pin: '12345' }, as('vorstand'))).toThrow(
      expect.objectContaining({ code: 'auth.pin-too-simple' }),
    );
    mockServer.handle('PUT', '/api/v1/club/pin', { pin: 'k7m2q' }, as('vorstand'));
    expect(() => mockServer.handle('POST', '/api/v1/me/step-up', { pin: MockDirectory.PIN }, as('trainer'))).toThrow(
      expect.objectContaining({ code: 'auth.pin-wrong' }),
    );
    directory.clubPin.data.pin = MockDirectory.PIN;
  });

  it('refuses PIN step-ups until a club PIN exists', () => {
    directory.clubPin.data.pin = null;
    expect(() => mockServer.handle('POST', '/api/v1/me/step-up', { pin: MockDirectory.PIN }, as('trainer'))).toThrow(
      expect.objectContaining({ code: 'auth.club-pin-not-set' }),
    );
    expect(mockServer.handle('GET', '/api/v1/me/security', undefined, as('trainer'))).toMatchObject({ clubPinSet: false, mfaRequired: false });
    directory.confirm(directory.members.data.find((m) => m.id === 'admin')!);
    mockServer.handle('PUT', '/api/v1/club/pin', { pin: MockDirectory.PIN }, as('admin'));
    expect(mockServer.handle('POST', '/api/v1/me/step-up', { pin: MockDirectory.PIN }, as('trainer'))).toMatchObject({ until: expect.any(String) });
  });

  it('locks only the member who guessed wrong, until an admin unlocks', () => {
    const trainer = directory.members.data.find((m) => m.id === 'trainer')!;
    for (let i = 1; i < 5; i++) expect(() => directory.stepUp(trainer, 'wrong')).toThrow(expect.objectContaining({ code: 'auth.pin-wrong' }));
    expect(() => directory.stepUp(trainer, 'wrong')).toThrow(expect.objectContaining({ code: 'auth.pin-locked' }));
    expect(() => directory.stepUp(trainer, MockDirectory.PIN)).toThrow(expect.objectContaining({ code: 'auth.pin-locked' }));
    expect(directory.securityStatus(trainer)).toMatchObject({ pinLocked: true });
    const admin = directory.members.data.find((m) => m.id === 'admin')!;
    directory.confirm(admin);
    directory.resetSecurity(admin, 'trainer');
    expect(directory.securityStatus(trainer)).toMatchObject({ pinLocked: false, stepUpUntil: null });
    expect(directory.stepUp(trainer, MockDirectory.PIN)).toMatchObject({ until: expect.any(String) });
  });

  it('sees the teams of wards', () => {
    expect([...directory.visibleTeamIds('eltern')]).toEqual(['t-u16']);
  });
});
