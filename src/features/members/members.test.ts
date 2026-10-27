import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../../lib/http/ApiClient';
import { SessionStore } from '../../lib/session/SessionStore.svelte';
import type { Member, Role } from '../../lib/types';
import { InviteForm, ProfileForm } from './MemberForms.svelte';
import { MemberListModel } from './MemberListModel.svelte';
import { MemberPolicy } from './MemberPolicy';
import type { MembersApi } from './MembersApi';

const TODAY = '2026-10-15';

const member = (id: string, roles: Role[], extra: Partial<Member> = {}): Member => ({
  id,
  email: `${id}@x.at`,
  firstName: id,
  lastName: 'Test',
  birthDate: '2000-01-01',
  phone: null,
  photoConsent: true,
  active: true,
  membershipTypes: [],
  previousType: null,
  memberSince: null,
  voter: false,
  eligible: false,
  roles,
  ...extra,
});

function policyFor(roles: Role[]): MemberPolicy {
  const session = new SessionStore(new ApiClient({ send: vi.fn(), upload: vi.fn(), url: (p) => p }, async () => false));
  session.me = { member: member('me', roles), teams: [], missing: [], wardIds: [], wardNames: {} };
  return new MemberPolicy(session);
}

describe('InviteForm', () => {
  it('validates e-mail, names and birth date like the server', () => {
    const form = new InviteForm(TODAY);
    expect(Object.keys(form.errors).sort()).toEqual(['email', 'firstName', 'lastName']);
    form.email = 'jörg@verein.at';
    form.firstName = 'Jörg';
    form.lastName = 'Muster';
    expect(form.errors.email).toBeDefined(); // umlaut before the @
    form.email = 'Joerg@Verein.at ';
    form.birthDate = '2030-01-01';
    expect(Object.keys(form.errors)).toEqual(['birthDate']);
    form.birthDate = '';
    form.phone = 'abc';
    expect(Object.keys(form.errors)).toEqual(['phone']);
    form.phone = ' +43 660 1234567 ';
    expect(form.toInvitation()).toEqual({
      email: 'joerg@verein.at',
      firstName: 'Jörg',
      lastName: 'Muster',
      birthDate: null,
      phone: '+43 660 1234567',
      photoConsent: false,
      guardianId: null,
      roles: ['PLAYER'],
      membershipType: 'ORDINARY',
    });
  });
});

describe('ProfileForm', () => {
  it('sends only changes and never erases a hidden birth date', () => {
    const hidden = member('x', ['PLAYER'], { birthDate: null, phone: '+43 1' });
    const form = new ProfileForm(hidden, TODAY);
    expect(form.toPatch()).toEqual({});
    form.phone = '';
    form.photoConsent = false;
    expect(form.toPatch()).toEqual({ phone: '', photoConsent: false }); // '' clears; null would mean "unchanged"
    form.phone = 'abc';
    expect(form.errors.phone).toBeDefined();
  });
});

describe('MemberListModel', () => {
  it('filters by search, role and activity', async () => {
    const api = {
      list: async () => ({
        items: [member('anna', ['ADMIN']), member('bert', ['PLAYER']), member('carl', ['PLAYER'], { active: false })],
        minorIds: ['bert'],
        wardIds: ['bert'],
        guardianIds: ['anna'],
      }),
    };
    const list = new MemberListModel(api as unknown as MembersApi);
    await list.load();
    expect(list.rows.map((m) => m.id)).toEqual(['anna', 'bert']);
    list.setFilter('inactive', '1');
    list.setFilter('role', 'PLAYER');
    expect(list.rows.map((m) => m.id)).toEqual(['bert', 'carl']);
    list.search = 'CARL@';
    expect(list.rows.map((m) => m.id)).toEqual(['carl']);
    expect(list.activeCount).toBe(2);
    list.search = '';
    list.setFilter('role', '');
    list.setFilter('family', 'minor');
    expect(list.rows.map((m) => m.id)).toEqual(['bert']);
    list.setFilter('family', 'guardian');
    expect(list.rows.map((m) => m.id)).toEqual(['anna']);
  });
});

describe('MemberPolicy', () => {
  it('reserves ADMIN powers for admins', () => {
    const board = policyFor(['BOARD']);
    const admin = policyFor(['ADMIN']);
    expect(board.grantableRoles()).not.toContain('ADMIN');
    expect(admin.grantableRoles()).toContain('ADMIN');
    expect(admin.grantableRoles()).not.toContain('BOARD'); // comes with a Vorstand office
    expect(board.canSetRoles(member('x', ['PLAYER']))).toBe(false);
    expect(board.canDeactivate(member('x', ['ADMIN']))).toBe(false);
    expect(admin.canDeactivate(member('x', ['ADMIN']))).toBe(true);
    expect(admin.canDeactivate(member('me', ['ADMIN']))).toBe(false);
    expect(board.canResetSecurity()).toBe(false);
    expect(policyFor(['COACH']).canInvite()).toBe(false);
  });
});
