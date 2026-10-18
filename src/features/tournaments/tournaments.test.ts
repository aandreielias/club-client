import { describe, expect, it } from 'vitest';
import { firstRound, koRounds, roundName, roundRobin, seeds, standings } from './logic';

describe('tournament logic', () => {
  it('pairs everyone once per group', () => {
    for (const n of [2, 3, 4, 5]) {
      const teams = Array.from({ length: n }, (_, i) => `t${i}`);
      const plan = roundRobin(teams);
      expect(plan).toHaveLength((n * (n - 1)) / 2);
      expect(new Set(plan.map((p) => [p.home, p.away].sort().join('-'))).size).toBe(plan.length);
    }
  });

  it('ranks by points, difference, goals and the direct match', () => {
    const teams = new Map([['a', 'A'], ['b', 'B'], ['c', 'C']]);
    const table = standings(teams, [
      { home: 'c', away: 'b', homeScore: 3, awayScore: 0 },
      { home: 'a', away: 'b', homeScore: 1, awayScore: 1 },
      { home: 'a', away: 'c', homeScore: null, awayScore: null },
    ], 3, 1);
    expect(table.map((r) => r.name)).toEqual(['C', 'A', 'B']);
    expect(table[1]).toMatchObject({ played: 1, drawn: 1, points: 1 });
  });

  it('seeds the knockout tree so a group meets itself late', () => {
    const order = seeds([['a1', 'a2'], ['b1', 'b2']], 2);
    expect(order).toEqual(['a1', 'b1', 'a2', 'b2']);
    expect(firstRound(order)).toEqual([{ slot: 0, home: 'a1', away: 'b2' }, { slot: 1, home: 'b1', away: 'a2' }]);
    expect(firstRound(['x', 'y', 'z'])[0]).toEqual({ slot: 0, home: 'x', away: null });
    expect(koRounds(6)).toBe(3);
    expect([1, 2, 3].map((r) => roundName(r, 3))).toEqual(['Viertelfinale', 'Halbfinale', 'Finale']);
  });
});

describe('mock tournaments', () => {
  it('runs a tournament from the draw to the final', async () => {
    const { directory, MockDirectory } = await import('../../lib/mock/core');
    const { tournaments } = await import('./mock');
    const member = (id: string) => directory.members.data.find((m) => m.id === id)!;
    directory.stepUp(member('trainer'), MockDirectory.PIN);
    const t = tournaments.create(member('trainer'), { name: 'Testcup', startsOn: '2026-12-05', endsOn: '2026-12-05', groupCount: 2, advancePerGroup: 2 });
    tournaments.setTeams(member('trainer'), t.id, ['A', 'B', 'C', 'D', 'E', 'F'].map((name) => ({ id: null, name, clubTeamId: null })));
    let state = tournaments.draw(member('trainer'), t.id);
    expect(state.groups).toHaveLength(2);
    state.matches.forEach((m, i) => (state = tournaments.setResult(member('trainer'), t.id, m.id, { homeScore: i + 1, awayScore: 0, startsAt: null, field: null })));
    state = tournaments.startKnockout(member('trainer'), t.id);
    const semis = state.matches.filter((m) => m.stage === 'KO' && m.round === 1);
    expect(semis).toHaveLength(2);
    expect(() => tournaments.setResult(member('trainer'), t.id, semis[0].id, { homeScore: 1, awayScore: 1, startsAt: null, field: null }))
      .toThrow(expect.objectContaining({ code: 'tournament.ko-draw' }));
    tournaments.setResult(member('trainer'), t.id, semis[0].id, { homeScore: 3, awayScore: 1, startsAt: null, field: null });
    state = tournaments.setResult(member('trainer'), t.id, semis[1].id, { homeScore: 0, awayScore: 2, startsAt: null, field: null });
    const final = state.matches.find((m) => m.stage === 'KO' && m.round === 2)!;
    expect([final.homeId, final.awayId]).toEqual([semis[0].homeId, semis[1].awayId]);
    state = tournaments.setResult(member('trainer'), t.id, final.id, { homeScore: 25, awayScore: 20, startsAt: null, field: null });
    expect(state.status).toBe('DONE');
  });

  it('lets a guest see only their tournament', async () => {
    const { directory } = await import('../../lib/mock/core');
    const { mockServer } = await import('../../lib/mock/MockServer');
    await import('./mock');
    await import('../calendar/mock');
    const ask = (path: string) => mockServer.handle('GET', path, null, 'gast@example.at');
    expect((ask('/api/v1/tournaments') as { items: { id: string }[] }).items.map((t) => t.id)).toEqual(['tm-herbst']);
    expect(() => ask('/api/v1/appointments?from=2026-01-01T00:00:00Z&to=2026-02-01T00:00:00Z')).toThrow(expect.objectContaining({ status: 403 }));
    expect(directory.activeIds()).not.toContain('gast');
  });
});
