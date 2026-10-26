import { describe, expect, it, vi } from 'vitest';
import type { Member, Role } from '../../lib/types';
import { membersToCsv, parseCsv, parseMemberImport, runMemberImport } from './MemberCsv.svelte';
import type { MembersApi } from './MembersApi';

const TODAY = '2026-10-15';
const GRANTABLE: Role[] = ['COACH', 'PLAYER', 'PARENT', 'VOLUNTEER'];

const member = (extra: Partial<Member> = {}): Member => ({
  id: 'm1', email: 'anna@x.at', firstName: 'Anna', lastName: 'Muster', birthDate: '2001-02-03', phone: '+43 660 1', photoConsent: true,
  active: true, roles: ['PLAYER', 'COACH'], membershipType: 'EXTRAORDINARY', honorary: true, memberSince: '2020-01-01', voter: true, eligible: true, ...extra,
});

describe('member CSV', () => {
  it('round-trips an export into an import', () => {
    const csv = membersToCsv([member()]);
    expect(csv.startsWith('﻿Vorname;Nachname;E-Mail;')).toBe(true);
    const parsed = parseMemberImport(csv.replace('anna@x.at', 'anna2@x.at'), TODAY, new Set(['anna@x.at']), GRANTABLE);
    expect(parsed.problems).toEqual([]);
    expect(parsed.rows).toEqual([{
      line: 2,
      invitation: { email: 'anna2@x.at', firstName: 'Anna', lastName: 'Muster', birthDate: '2001-02-03', phone: '+43 660 1', photoConsent: true, guardianId: null, roles: ['PLAYER', 'COACH'], membershipType: 'EXTRAORDINARY' },
      membership: { membershipType: 'EXTRAORDINARY', honorary: true, memberSince: '2020-01-01' },
    }]);
  });

  it('quotes cells and defuses formulas', () => {
    const csv = membersToCsv([member({ lastName: 'A;"B"', firstName: '=CMD()' })]);
    expect(csv).toContain(`'=CMD();"A;""B""";`);
    expect(parseCsv('a;"x;\n""y""";c\r\n1;2;3', ';')).toEqual([['a', 'x;\n"y"', 'c'], ['1', '2', '3']]);
  });

  it('reports bad lines, duplicates and missing columns', () => {
    const csv = [
      'E-Mail,Vorname,Nachname,Geburtsdatum,Rollen',
      'a@x.at,A,One,03.05.2010,Spieler:in',
      'a@x.at,A,Two,,',
      'b@x.at,B,Three,gestern,',
      'c@x.at,C,Four,,Admin',
      'not-an-email,D,Five,,',
      ',,,,',
    ].join('\n');
    const parsed = parseMemberImport(csv, TODAY, new Set(), GRANTABLE);
    expect(parsed.rows.map((r) => [r.line, r.invitation.birthDate, r.invitation.roles, r.invitation.membershipType, r.membership])).toEqual([[2, '2010-05-03', ['PLAYER'], null, null]]);
    expect(parsed.problems.map((p) => p.line)).toEqual([3, 4, 5, 6]);
    expect(parsed.problems[3].text).toMatch(/^E-Mail:/);
    expect(parseMemberImport('Name;Mail\nx;y', TODAY, new Set(), GRANTABLE).problems).toEqual([{ line: 1, text: 'Spalten fehlen: Vorname, Nachname, E-Mail.' }]);
  });

  it('keeps importing after a failed line', async () => {
    const parsed = parseMemberImport('Vorname;Nachname;E-Mail;Ehrenmitglied\nA;B;a@x.at;ja\nC;D;c@x.at;nein', TODAY, new Set(), GRANTABLE);
    const api = {
      invite: vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ id: 'n2' }),
      setMembership: vi.fn(),
    } as unknown as MembersApi;
    expect(await runMemberImport(api, parsed.rows, () => 'Fehler')).toEqual([{ line: 2, text: 'Fehler' }]);
    expect(api.invite).toHaveBeenCalledTimes(2);
    expect(api.setMembership).not.toHaveBeenCalled();
  });
});
