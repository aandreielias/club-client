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

export interface Result {
  home: string | null;
  away: string | null;
  homeScore: number | null;
  awayScore: number | null;
}

export interface Standing {
  teamId: string;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

const played = (r: Result) => r.home !== null && r.away !== null && r.homeScore !== null && r.awayScore !== null;

/** Group table: points, goal difference, goals scored, the direct match, then the name. */
export function standings(teams: ReadonlyMap<string, string>, results: readonly Result[], pointsWin: number, pointsDraw: number): Standing[] {
  const rows = new Map<string, Standing>(
    [...teams].map(([teamId, name]) => [teamId, { teamId, name, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 }]),
  );
  const add = (row: Standing, scored: number, conceded: number) => {
    row.played++;
    if (scored > conceded) row.won++;
    else if (scored === conceded) row.drawn++;
    else row.lost++;
    row.goalsFor += scored;
    row.goalsAgainst += conceded;
  };
  for (const r of results) {
    const home = r.home && rows.get(r.home);
    const away = r.away && rows.get(r.away);
    if (!played(r) || !home || !away) continue;
    add(home, r.homeScore!, r.awayScore!);
    add(away, r.awayScore!, r.homeScore!);
  }
  const list = [...rows.values()];
  list.forEach((row) => (row.points = row.won * pointsWin + row.drawn * pointsDraw));
  const headToHead = (a: string, b: string) => {
    let balance = 0;
    for (const r of results) {
      if (!played(r)) continue;
      if (r.home === a && r.away === b) balance += r.homeScore! - r.awayScore!;
      else if (r.home === b && r.away === a) balance += r.awayScore! - r.homeScore!;
    }
    return -Math.sign(balance);
  };
  return list.sort(
    (a, b) =>
      b.points - a.points ||
      b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
      b.goalsFor - a.goalsFor ||
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
