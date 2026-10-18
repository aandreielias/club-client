import { describe, expect, it } from 'vitest';
import { firstRound, koRounds, roundName, roundRobin, seeds, setsProblem, standings, tablePoints, tally } from './logic';

describe('tournament logic', () => {
  it('pairs everyone once per group', () => {
    for (const n of [2, 3, 4, 5]) {
      const teams = Array.from({ length: n }, (_, i) => `t${i}`);
      const plan = roundRobin(teams);
      expect(plan).toHaveLength((n * (n - 1)) / 2);
      expect(new Set(plan.map((p) => [p.home, p.away].sort().join('-'))).size).toBe(plan.length);
    }
  });

  it('gives 3:0 or 2:1 table points and ranks by points, wins, set ratio, then ball-point ratio', () => {
    const teams = new Map([['a', 'A'], ['b', 'B'], ['c', 'C']]);
    const result = (home: string, away: string, sets: { home: number; away: number }[]) => ({ home, away, ...tally(sets) });
    let table = standings(teams, [
      result('c', 'b', [{ home: 25, away: 20 }, { home: 25, away: 10 }]),
      result('a', 'b', [{ home: 25, away: 20 }, { home: 20, away: 25 }, { home: 15, away: 13 }]),
      result('a', 'c', []),
    ]);
    expect(table.map((r) => r.name)).toEqual(['C', 'A', 'B']);
    expect(table.map((r) => r.points)).toEqual([3, 2, 1]);
    expect(table[1]).toMatchObject({ played: 1, won: 1, setsWon: 2, setsLost: 1, ballsWon: 60 });
    table = standings(teams, [
      result('a', 'c', [{ home: 25, away: 20 }, { home: 25, away: 20 }]),
      result('b', 'c', [{ home: 25, away: 15 }, { home: 25, away: 15 }]),
    ]);
    expect(table.map((r) => r.name)).toEqual(['B', 'A', 'C']);
  });

  it('checks sets by the usual volleyball rules', () => {
    const sets = (...points: number[]) => Array.from({ length: points.length / 2 }, (_, i) => ({ home: points[2 * i], away: points[2 * i + 1] }));
    expect(setsProblem([], 3)).toBeNull();
    expect(setsProblem(sets(25, 23, 30, 28, 25, 10), 3)).toBeNull();
    expect(setsProblem(sets(20, 25, 25, 18, 25, 0, 23, 25, 16, 14), 3)).toBeNull();
    expect(setsProblem(sets(25, 20, 18, 25, 15, 13), 2)).toBeNull();
    expect(setsProblem(sets(25, 24, 25, 0, 25, 0), 3)).toEqual({ code: 'tournament.set-invalid', set: 1 });
    expect(setsProblem(sets(25, 20, 30, 27), 2)).toEqual({ code: 'tournament.set-invalid', set: 2 });
    expect(setsProblem(sets(25, 20, 20, 25, 25, 20), 2)).toEqual({ code: 'tournament.set-invalid', set: 3 });
    expect(setsProblem(sets(25, 20, 25, 20), 3)).toEqual({ code: 'tournament.match-open', set: 2 });
    expect(setsProblem(sets(25, 20, 25, 20, 25, 20), 2)).toEqual({ code: 'tournament.match-over', set: 2 });
    expect(tablePoints(3, 2)).toEqual([2, 1]);
    expect(tablePoints(2, 0)).toEqual([3, 0]);
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
    state.matches.forEach((m, i) => (state = tournaments.setResult(member('trainer'), t.id, m.id, { sets: Array.from({ length: 2 }, () => ({ home: 25, away: 20 - i })), startsAt: null, field: null })));
    state = tournaments.startKnockout(member('trainer'), t.id);
    const semis = state.matches.filter((m) => m.stage === 'KO' && m.round === 1);
    expect(semis).toHaveLength(2);
    expect(() => tournaments.setResult(member('trainer'), t.id, semis[0].id, { sets: [{ home: 25, away: 20 }, { home: 20, away: 25 }], startsAt: null, field: null }))
      .toThrow(expect.objectContaining({ code: 'tournament.match-open' }));
    tournaments.setResult(member('trainer'), t.id, semis[0].id, { sets: [{ home: 25, away: 20 }, { home: 25, away: 22 }], startsAt: null, field: null });
    state = tournaments.setResult(member('trainer'), t.id, semis[1].id, { sets: [{ home: 20, away: 25 }, { home: 18, away: 25 }], startsAt: null, field: null });
    const final = state.matches.find((m) => m.stage === 'KO' && m.round === 2)!;
    expect([final.homeId, final.awayId]).toEqual([semis[0].homeId, semis[1].awayId]);
    state = tournaments.setResult(member('trainer'), t.id, final.id, { sets: [{ home: 25, away: 20 }, { home: 23, away: 25 }, { home: 15, away: 12 }], startsAt: null, field: null });
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
