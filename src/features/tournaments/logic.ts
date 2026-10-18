// Tournament rules, the same as the server's (tournaments.domain: RoundRobin, Standings, Bracket).

export interface Pairing {
  round: number;
  home: string;
  away: string;
}

/** Everyone plays everyone once (circle method); with an odd number one team rests each round. */
export function roundRobin(teams: readonly string[]): Pairing[] {
  const circle: (string | null)[] = [...teams];
  if (circle.length % 2) circle.push(null);
  const n = circle.length;
  const out: Pairing[] = [];
  for (let round = 0; round < n - 1; round++) {
    for (let i = 0; i < n / 2; i++) {
      const a = circle[i];
      const b = circle[n - 1 - i];
      if (a && b) out.push(round % 2 === 0 ? { round: round + 1, home: a, away: b } : { round: round + 1, home: b, away: a });
    }
    circle.splice(1, 0, circle.pop()!);
  }
  return out;
}

/** Sets won and ball points of one match. */
export interface Result {
  home: string | null;
  away: string | null;
  homeSets: number | null;
  awaySets: number | null;
  homePoints: number;
  awayPoints: number;
}

export interface Standing {
  teamId: string;
  name: string;
  played: number;
  won: number;
  lost: number;
  setsWon: number;
  setsLost: number;
  ballsWon: number;
  ballsLost: number;
  points: number;
}

const played = (r: Result) => r.home !== null && r.away !== null && r.homeSets !== null && r.awaySets !== null;

/** Sets won by each side and the ball points of a list of sets. */
export function tally(sets: readonly { home: number; away: number }[]) {
  return {
    homeSets: sets.length ? sets.filter((s) => s.home > s.away).length : null,
    awaySets: sets.length ? sets.filter((s) => s.away > s.home).length : null,
    homePoints: sets.reduce((sum, s) => sum + s.home, 0),
    awayPoints: sets.reduce((sum, s) => sum + s.away, 0),
  };
}

/** Points a set is played to (server: Volleyball.target): 15 in the deciding set, else 25. */
export const setTarget = (index: number, setsToWin: number): number => (index === 2 * setsToWin - 2 ? 15 : 25);

export type SetsProblem = { code: 'tournament.set-invalid' | 'tournament.match-over' | 'tournament.match-open'; set: number };

/**
 * Why sets are no finished match by the usual rules (server: Volleyball.requireValid): a set goes to 25, the deciding
 * set to 15, with two points ahead; the match ends when a team has `setsToWin` sets. Null when fine or empty (no result).
 */
export function setsProblem(sets: readonly { home: number; away: number }[], setsToWin: number): SetsProblem | null {
  let home = 0;
  let away = 0;
  for (const [i, set] of sets.entries()) {
    if (home === setsToWin || away === setsToWin) return { code: 'tournament.match-over', set: i };
    const target = setTarget(i, setsToWin);
    const winner = Math.max(set.home, set.away);
    const loser = Math.min(set.home, set.away);
    if (!((winner === target && loser <= target - 2) || (winner > target && winner - loser === 2))) return { code: 'tournament.set-invalid', set: i + 1 };
    if (set.home > set.away) home++;
    else away++;
  }
  return sets.length && home < setsToWin && away < setsToWin ? { code: 'tournament.match-open', set: sets.length } : null;
}

/** Table points of winner and loser: 3:0 for a clear win, 2:1 when it went to the deciding set. */
export const tablePoints = (winnerSets: number, loserSets: number): [number, number] => (loserSets === winnerSets - 1 ? [2, 1] : [3, 0]);

/** Won sets per lost set; Infinity without a lost one. */
const ratio = (won: number, lost: number) => (lost ? won / lost : won ? Infinity : 0);

/** Volleyball group table: points (3:0, 2:1), wins, set ratio, ball-point ratio, the direct match, then the name. */
export function standings(teams: ReadonlyMap<string, string>, results: readonly Result[]): Standing[] {
  const rows = new Map<string, Standing>(
    [...teams].map(([teamId, name]) => [teamId, { teamId, name, played: 0, won: 0, lost: 0, setsWon: 0, setsLost: 0, ballsWon: 0, ballsLost: 0, points: 0 }]),
  );
  const add = (row: Standing, won: number, lost: number, balls: number, ballsAgainst: number) => {
    row.played++;
    if (won > lost) {
      row.won++;
      row.points += tablePoints(won, lost)[0];
    } else if (lost > won) {
      row.lost++;
      row.points += tablePoints(lost, won)[1];
    }
    row.setsWon += won;
    row.setsLost += lost;
    row.ballsWon += balls;
    row.ballsLost += ballsAgainst;
  };
  for (const r of results) {
    const home = r.home && rows.get(r.home);
    const away = r.away && rows.get(r.away);
    if (!played(r) || !home || !away) continue;
    add(home, r.homeSets!, r.awaySets!, r.homePoints, r.awayPoints);
    add(away, r.awaySets!, r.homeSets!, r.awayPoints, r.homePoints);
  }
  const list = [...rows.values()];
  const headToHead = (a: string, b: string) => {
    let balance = 0;
    for (const r of results) {
      if (!played(r)) continue;
      if (r.home === a && r.away === b) balance += r.homeSets! - r.awaySets!;
      else if (r.home === b && r.away === a) balance += r.awaySets! - r.homeSets!;
    }
    return -Math.sign(balance);
  };
  const compare = (x: number, y: number) => (x === y ? 0 : x > y ? 1 : -1); // Infinity - Infinity would be NaN
  return list.sort(
    (a, b) =>
      b.points - a.points ||
      b.won - a.won ||
      compare(ratio(b.setsWon, b.setsLost), ratio(a.setsWon, a.setsLost)) ||
      compare(ratio(b.ballsWon, b.ballsLost), ratio(a.ballsWon, a.ballsLost)) ||
      headToHead(a.teamId, b.teamId) ||
      a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }),
  );
}

/** Seed order: group winners (A1, B1, …), then runners-up (A2, B2, …), and so on. */
export function seeds(rankedGroups: readonly (readonly string[])[], advance: number): string[] {
  const out: string[] = [];
  for (let place = 0; place < advance; place++) for (const group of rankedGroups) if (place < group.length) out.push(group[place]);
  return out;
}

export const bracketSize = (qualifiers: number): number => {
  let size = 2;
  while (size < qualifiers) size *= 2;
  return size;
};

export const koRounds = (qualifiers: number): number => Math.log2(bracketSize(qualifiers));

/** First round, 1 against the last (A1–B2, B1–A2); null is a bye. */
export function firstRound(seedList: readonly string[]): { slot: number; home: string | null; away: string | null }[] {
  const size = bracketSize(seedList.length);
  let order = [0, 1];
  while (order.length < size) order = order.flatMap((seed) => [seed, order.length * 2 - 1 - seed]);
  return Array.from({ length: size / 2 }, (_, slot) => ({
    slot,
    home: seedList[order[2 * slot]] ?? null,
    away: seedList[order[2 * slot + 1]] ?? null,
  }));
}

/** "Finale", "Halbfinale", "Viertelfinale", "Achtelfinale", else "Runde n". */
export function roundName(round: number, rounds: number): string {
  return ['Finale', 'Halbfinale', 'Viertelfinale', 'Achtelfinale'][rounds - round] ?? `Runde ${round}`;
}
