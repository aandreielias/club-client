import { describe, expect, it, vi } from 'vitest';
import type { Member, Role } from '../../lib/types';
import { membersToCsv, parseCsv, parseMemberImport, runMemberImport } from './MemberCsv.svelte';
import type { MembersApi } from './MembersApi';

const TODAY = '2026-10-15';
const GRANTABLE: Role[] = ['COACH', 'PLAYER', 'PARENT', 'VOLUNTEER'];

const member = (extra: Partial<Member> = {}): Member => ({
  id: 'm1',
  email: 'anna@x.at',
  firstName: 'Anna',
  lastName: 'Muster',
  birthDate: '2001-02-03',
  phone: '+43 660 1',
  photoConsent: true,
  active: true,
  roles: ['PLAYER', 'COACH'],
  membershipTypes: ['HONORARY'],
  previousType: 'EXTRAORDINARY',
  memberSince: '2020-01-01',
  voter: true,
  eligible: true,
  login: true,
  ...extra,
});

describe('member CSV', () => {
  it('round-trips an export into an import', () => {
    const csv = membersToCsv([member()]);
    expect(csv.startsWith('﻿Vorname;Nachname;E-Mail;')).toBe(true);
    const parsed = parseMemberImport(csv.replace('anna@x.at', 'anna2@x.at'), TODAY, new Set(['anna@x.at']), GRANTABLE);
    expect(parsed.problems).toEqual([]);
    expect(parsed.rows).toEqual([
      {
        line: 2,
        invitation: {
          email: 'anna2@x.at',
          firstName: 'Anna',
          lastName: 'Muster',
          birthDate: '2001-02-03',
          phone: '+43 660 1',
          photoConsent: true,
          guardianId: null,
          roles: ['PLAYER', 'COACH'],
          membershipType: 'EXTRAORDINARY',
        },
        membership: { membershipTypes: ['HONORARY'], memberSince: '2020-01-01' },
        guardianEmail: null,
        teams: [],
      },
    ]);
  });

  it('quotes cells and defuses formulas', () => {
    const csv = membersToCsv([member({ lastName: 'A;"B"', firstName: '=CMD()' })]);
    expect(csv).toContain(`'=CMD();"A;""B""";`);
    expect(parseCsv('a;"x;\n""y""";c\r\n1;2;3', ';')).toEqual([
      ['a', 'x;\n"y"', 'c'],
      ['1', '2', '3'],
    ]);
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
    expect(parsed.rows.map((r) => [r.line, r.invitation.birthDate, r.invitation.roles, r.invitation.membershipType, r.membership])).toEqual([
      [2, '2010-05-03', ['PLAYER'], null, null],
    ]);
    expect(parsed.problems.map((p) => p.line)).toEqual([3, 4, 5, 6]);
    expect(parsed.problems[3].text).toMatch(/^E-Mail:/);
    expect(parseMemberImport('Name;Mail\nx;y', TODAY, new Set(), GRANTABLE).problems).toEqual([
      { line: 1, text: 'Spalten fehlen: Vorname, Nachname, E-Mail.' },
    ]);
  });

  it('imports a child without e-mail when a guardian is given', () => {
    const csv = ['E-Mail;Vorname;Nachname;Erziehungsberechtigte:r', ';Kim;Klein;eltern@x.at', ';Ola;Ohne;'].join('\n');
    const parsed = parseMemberImport(csv, TODAY, new Set(), GRANTABLE);
    expect(parsed.rows.map((r) => [r.invitation.email, r.guardianEmail])).toEqual([[null, 'eltern@x.at']]);
    expect(parsed.problems).toEqual([{ line: 3, text: expect.stringMatching(/^E-Mail fehlt/) }]);
  });

  it('keeps importing after a failed line', async () => {
    const parsed = parseMemberImport('Vorname;Nachname;E-Mail;Ehrenmitglied\nA;B;a@x.at;ja\nC;D;c@x.at;nein', TODAY, new Set(), GRANTABLE);
    const api = {
      invite: vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ id: 'n2' }),
      setMembership: vi.fn(),
    } as unknown as MembersApi;
    expect(
      await runMemberImport(
        api,
        parsed.rows,
        () => 'Fehler',
        null,
        async () => {},
      ),
    ).toEqual([{ line: 2, text: 'Fehler' }]);
    expect(api.invite).toHaveBeenCalledTimes(2);
    expect(api.setMembership).not.toHaveBeenCalled();
  });
});

describe('import links', () => {
  it('links guardians from the file or the club and joins teams, waiting on "too many requests"', async () => {
    const calls: string[] = [];
    let first = true;
    const api = {
      invite: async (i: { email: string }) => {
        if (i.email === 'kind@sdg.at' && first) {
          first = false;
          throw Object.assign(new Error('slow'), { status: 429 });
        }
        return { id: `id-${i.email}` };
      },
      setMembership: async () => ({}),
      linkGuardian: async (minor: string, guardian: string) => calls.push(`guardian ${minor} ${guardian}`),
    } as never;
    const rows = [
      { line: 2, invitation: { email: 'mama@sdg.at' }, membership: null, guardianEmail: null, teams: [] },
      { line: 3, invitation: { email: 'kind@sdg.at' }, membership: null, guardianEmail: 'mama@sdg.at', teams: ['U16', 'Gibt es nicht'] },
    ] as never;
    const waits: number[] = [];
    const problems = await runMemberImport(
      api,
      rows,
      () => 'Fehler',
      { existing: new Map(), teams: [{ id: 't1', name: 'U16' }], setTeam: async (team, member) => calls.push(`team ${team} ${member}`) },
      async (ms) => void waits.push(ms),
    );
    expect(calls).toEqual(['guardian id-kind@sdg.at id-mama@sdg.at', 'team t1 id-kind@sdg.at']);
    expect(problems).toEqual([{ line: 3, text: 'Team „Gibt es nicht“ nicht gefunden.' }]);
    expect(waits).toContain(30_000);
  });
});
