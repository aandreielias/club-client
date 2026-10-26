import { describe, expect, it, vi } from 'vitest';
import type { Member } from '../types';
import { directory, MockDirectory } from './core';
import { mockServer } from './MockServer';
import { MockSocket } from './MockSocket';

const member = (id: string): Member => directory.members.data.find((m) => m.id === id)!;
const stepUp = (id: string) => directory.stepUp(member(id), MockDirectory.PIN);

describe('mock members admin', () => {
  it('invites with the server rules', () => {
    expect(() => directory.invite(member('vorstand'), { email: 'a@b.at', firstName: 'A', lastName: 'B', roles: [] }))
      .toThrow(expect.objectContaining({ code: 'auth.step-up-required' }));
    stepUp('vorstand');
    expect(() => directory.invite(member('vorstand'), { email: 'x@b.at', firstName: 'X', lastName: 'Y', roles: ['ADMIN'] }))
      .toThrow(expect.objectContaining({ code: 'access.denied' }));
    expect(() => directory.invite(member('vorstand'), { email: 'admin@example.at', firstName: 'X', lastName: 'Y', roles: [] }))
      .toThrow(expect.objectContaining({ code: 'member.email-taken' }));
    const invited = directory.invite(member('vorstand'), { email: 'Neu@Verein.AT', firstName: ' Nina ', lastName: 'Neu', roles: ['PLAYER'] });
    expect(invited).toMatchObject({ email: 'neu@verein.at', firstName: 'Nina', photoConsent: false, active: true });
  });

  it('takes the whole application form: phone, photo consent and a guardian', () => {
    const body = { email: 'kind@verein.at', firstName: 'Kim', lastName: 'Kind', roles: ['PLAYER'], phone: '+43 1 234', photoConsent: true };
    expect(() => directory.invite(member('vorstand'), { ...body, guardianId: 'nobody' })).toThrow(expect.objectContaining({ code: 'member.not-found' }));
    expect(directory.members.data.some((m) => m.email === 'kind@verein.at')).toBe(false);
    const kid = directory.invite(member('vorstand'), { ...body, guardianId: 'neu' });
    expect(kid).toMatchObject({ phone: '+43 1 234', photoConsent: true });
    expect(directory.wardsOf('neu')).toContain(kid.id);
  });

  it('gives BOARD only with a board office (server: MembershipHandlers)', () => {
    stepUp('vorstand');
    const today = directory.clock.today();
    expect(() => directory.assignOffice(member('vorstand'), { memberId: 'spielerin', office: 'TREASURER', startsOn: today }))
      .toThrow(expect.objectContaining({ code: 'office.not-eligible' }));
    expect(() => directory.assignOffice(member('vorstand'), { memberId: 'trainer', office: 'CHAIR', startsOn: today }))
      .toThrow(expect.objectContaining({ code: 'office.taken' }));
    expect(() => directory.assignOffice(member('vorstand'), { memberId: 'admin', office: 'BOARD_MEMBER', startsOn: today }))
      .toThrow(expect.objectContaining({ code: 'office.combination' }));
    expect(directory.board().warnings).toEqual([]); // the seeded board of five is complete
    const office = directory.assignOffice(member('vorstand'), { memberId: 'trainer', office: 'BOARD_MEMBER', startsOn: today });
    expect(member('trainer').roles).toContain('BOARD');
    expect(directory.board().warnings).toEqual(['board.even']);
    expect(() => directory.setMembership(member('vorstand'), 'trainer', { membershipType: 'ORDINARY' }))
      .toThrow(expect.objectContaining({ code: 'member.holds-office' }));
    expect(() => directory.setRoles(member('admin'), 'trainer', ['COACH'])).toThrow(expect.objectContaining({ code: 'auth.step-up-required' }));
    stepUp('admin');
    expect(() => directory.setRoles(member('admin'), 'trainer', ['COACH'])).toThrow(expect.objectContaining({ code: 'member.board-by-office' }));
    directory.endOffice(member('vorstand'), office.id);
    expect(member('trainer').roles).not.toContain('BOARD');
  });

  it('shows birth dates only to self, admin, board, guardians and coaches', () => {
    expect(directory.get(member('vorstand'), 'spieler').birthDate).toBe('2010-01-20');
    expect(directory.get(member('trainer'), 'spieler').birthDate).toBe('2010-01-20');
    expect(directory.get(member('eltern'), 'spieler').birthDate).toBe('2010-01-20');
    expect(() => directory.get(member('spielerin'), 'spieler')).toThrow(expect.objectContaining({ code: 'member.not-found' }));
  });

  it('protects admin roles and self-deactivation', () => {
    stepUp('admin');
    expect(() => directory.setRoles(member('admin'), 'admin', ['BOARD'])).toThrow(expect.objectContaining({ code: 'member.cannot-remove-own-admin' }));
    expect(() => directory.deactivate(member('admin'), 'admin')).toThrow(expect.objectContaining({ code: 'member.cannot-deactivate-self' }));
    stepUp('vorstand');
    expect(() => directory.deactivate(member('vorstand'), 'admin')).toThrow(expect.objectContaining({ code: 'access.denied' }));
  });

  it('deactivation removes team memberships and closes the live connection with 4403', async () => {
    const socket = new MockSocket(mockServer.events, (email) => directory.findActive(email), 60_000);
    const closed = new Promise<number>((resolve) => (socket.onclose = (e) => resolve(e.code)));
    socket.onmessage = vi.fn();
    socket.send(JSON.stringify({ type: 'auth', token: 'dev:neu@example.at' }));
    stepUp('admin');
    directory.deactivate(member('admin'), 'neu');
    expect(directory.teamRoles('neu')).toEqual({});
    expect(await closed).toBe(4403);
    expect(directory.findActive('neu@example.at')).toBeNull();
  });

  it('links guardians and resets security', () => {
    stepUp('admin');
    expect(() => directory.linkGuardian(member('admin'), 'spieler', 'spieler')).toThrow(expect.objectContaining({ code: 'member.guardian-is-self' }));
    directory.linkGuardian(member('admin'), 'spielerin', 'eltern');
    expect(directory.wardsOf('eltern')).toEqual(['spieler', 'spielerin']);
    stepUp('trainer');
    directory.resetSecurity(member('admin'), 'trainer');
    expect(directory.securityStatus(member('trainer'))).toMatchObject({ clubPinSet: true, pinLocked: false, stepUpUntil: null });
  });
});

describe('mock teams admin', () => {
  it('creates teams and manages rosters with the server rules', () => {
    stepUp('vorstand');
    expect(() => directory.createTeam(member('vorstand'), { name: 'Herren', season: '2026-27' })).toThrow(expect.objectContaining({ code: 'team.season-invalid' }));
    const team = directory.createTeam(member('vorstand'), { name: 'Herren', season: '2026/27' });
    expect(() => directory.createTeam(member('vorstand'), { name: 'Herren', season: '2026/27' })).toThrow(expect.objectContaining({ code: 'team.exists' }));
    const roster = directory.setTeamMember(member('vorstand'), team.id, 'trainer', 'COACH');
    expect(roster.entries).toEqual([expect.objectContaining({ memberId: 'trainer', teamRole: 'COACH' })]);

    stepUp('trainer'); // ended by the reset in the previous test
    expect(() => directory.setTeamMember(member('trainer'), 't-u16', 'spielerin', 'PLAYER')).toThrow(expect.objectContaining({ code: 'access.denied' }));
    expect(() => directory.setTeamMember(member('spielerin'), 't-u16', 'neu', 'PLAYER')).toThrow(expect.objectContaining({ code: 'team.not-found' }));
    directory.removeTeamMember(member('trainer'), 't-u16', 'spieler');
    expect(directory.teamMembers('t-u16')).toEqual(['trainer', 'sara']);
    expect(() => directory.removeTeamMember(member('trainer'), 't-u16', 'trainer')).toThrow(expect.objectContaining({ code: 'access.denied' }));
  });
});

describe('mock family', () => {
  it('shows the guardian link on both profiles, for who may open them', () => {
    expect(directory.family(member('eltern'), 'spieler').guardians).toEqual([{ memberId: 'eltern', name: 'Eva Eltern', canOpen: true }]);
    expect(directory.family(member('eltern'), 'eltern').wards.map((w) => w.memberId)).toContain('spieler');
    expect(() => directory.family(member('spieler'), 'eltern')).toThrow(expect.objectContaining({ code: 'member.not-found' }));
  });
});
