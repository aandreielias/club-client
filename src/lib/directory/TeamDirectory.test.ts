import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../http/ApiClient';
import type { Transport } from '../http/Transport';
import { SessionStore } from '../session/SessionStore.svelte';
import { ClubPermissions } from '../policy/ClubPermissions';
import type { Me, Roster } from '../types';
import { TeamDirectory } from './TeamDirectory.svelte';

const me: Me = {
  member: { id: 'm1', email: 'c@x.at', firstName: 'Clara', lastName: 'Coach', birthDate: null, phone: null, photoConsent: true, active: true, roles: ['COACH'] },
  teams: [
    { id: 'a', name: 'Team A', season: '2026/27' },
    { id: 'b', name: 'Team B', season: '2026/27' },
  ],
  missing: [],
  wardIds: [],
  wardNames: {},
};

const rosters: Record<string, Roster> = {
  a: { team: me.teams[0], entries: [{ memberId: 'm1', name: 'Clara Coach', teamRole: 'COACH' }, { memberId: 'm2', name: 'Pia Player', teamRole: 'PLAYER' }] },
  b: { team: me.teams[1], entries: [{ memberId: 'm1', name: 'Clara Coach', teamRole: 'PLAYER' }] },
};

function setup() {
  const send = vi.fn<Transport['send']>(async (_method, path) => {
    const roster = /\/teams\/(\w+)\/roster/.exec(path);
    if (roster) return rosters[roster[1]];
    throw new Error(`unexpected ${path}`);
  });
  const api = new ApiClient({ send, upload: vi.fn(), url: (p) => p }, async () => false);
  const session = new SessionStore(api);
  session.me = me;
  const directory = new TeamDirectory(api, session);
  return { send, directory, permissions: new ClubPermissions(session, directory) };
}

describe('TeamDirectory', () => {
  it('resolves names from rosters and caches each roster once', async () => {
    const { send, directory } = setup();
    expect(directory.nameOf('m2')).toBe('Mitglied');
    await Promise.all([directory.loadRosters(), directory.loadRosters(['a'])]);
    expect(directory.nameOf('m2')).toBe('Pia Player');
    expect(directory.nameOf('m1')).toBe('Clara Coach');
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('lets permissions use exact team roles once rosters are loaded', async () => {
    const { directory, permissions } = setup();
    expect(permissions.manageableTeams().map((t) => t.id)).toEqual(['a', 'b']); // assumed until known
    await directory.loadRosters();
    expect(permissions.manageableTeams().map((t) => t.id)).toEqual(['a']);
    expect(permissions.canManage('b')).toBe(false);
    expect(permissions.canManage(null)).toBe(false);
  });
});
