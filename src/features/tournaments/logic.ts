// Tournament rules, the same as the server's (tournaments.domain: RoundRobin, Standings, Bracket).
import type { StandingRow, TournamentFormat } from './model';

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

/** Points a set is played to (server: Scoring.target): 15 in the deciding set, else 25 (beach 21). */
export const setTarget = (format: TournamentFormat, index: number, setsToWin: number): number =>
  index === 2 * setsToWin - 2 ? 15 : format === 'BEACH' ? 21 : 25;

export type SetsProblem = { code: 'tournament.set-invalid' | 'tournament.match-over' | 'tournament.match-open'; set: number };

/**
 * Why sets are no finished match by the rules (server: Scoring.requireValid): a set goes to 25 (beach 21), the deciding
 * set to 15, with two points ahead; the match ends when a team has `setsToWin` sets. Null when fine or empty (no result).
 */
export function setsProblem(sets: readonly { home: number; away: number }[], setsToWin: number, format: TournamentFormat = 'VOLLEYBALL'): SetsProblem | null {
  let home = 0;
  let away = 0;
  for (const [i, set] of sets.entries()) {
    if (home === setsToWin || away === setsToWin) return { code: 'tournament.match-over', set: i };
    const target = setTarget(format, i, setsToWin);
    const winner = Math.max(set.home, set.away);
    const loser = Math.min(set.home, set.away);
    if (!((winner === target && loser <= target - 2) || (winner > target && winner - loser === 2))) return { code: 'tournament.set-invalid', set: i + 1 };
    if (set.home > set.away) home++;
    else away++;
  }
  return sets.length && home < setsToWin && away < setsToWin ? { code: 'tournament.match-open', set: sets.length } : null;
}

/** Table points of winner and loser. Volleyball: 3:0 for a clear win, 2:1 after the deciding set; beach 2:1; simple 3:0 (a draw 1 each). */
export function tablePoints(format: TournamentFormat, winnerSets: number, loserSets: number): [number, number] {
  if (format === 'BEACH') return [2, 1];
  return format === 'VOLLEYBALL' && loserSets === winnerSets - 1 ? [2, 1] : [3, 0];
}

/** Won sets per lost set; Infinity without a lost one. */
const ratio = (won: number, lost: number) => (lost ? won / lost : won ? Infinity : 0);

/** Group table: points (see tablePoints), wins, set ratio, ball-point ratio, the direct match, then the name. */
export function standings(teams: ReadonlyMap<string, string>, results: readonly Result[], format: TournamentFormat = 'VOLLEYBALL'): StandingRow[] {
  const rows = new Map<string, StandingRow>(
    [...teams].map(([teamId, name]) => [teamId, { teamId, name, played: 0, won: 0, drawn: 0, lost: 0, setsWon: 0, setsLost: 0, ballsWon: 0, ballsLost: 0, points: 0 }]),
  );
  const add = (row: StandingRow, won: number, lost: number, balls: number, ballsAgainst: number) => {
    row.played++;
    if (won > lost) {
      row.won++;
      row.points += tablePoints(format, won, lost)[0];
    } else if (lost > won) {
      row.lost++;
      row.points += tablePoints(format, lost, won)[1];
    } else {
      row.drawn++;
      row.points += 1;
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

/**
 * server: FieldPlan. Spreads matches over `fields` in waves (Durchgänge): per wave at most one match per field and
 * no team twice; earlier rounds first, groups taking turns. Returns the matches with field and wave set.
 */
export function fieldPlan<M extends { id: string; round: number; slot: number; group: string | null; homeId: string | null; awayId: string | null }>(
  matches: readonly M[],
  fields: number,
  firstWave: number,
): (M & { field: string; wave: number })[] {
  const pending = [...matches].sort((a, b) => a.round - b.round || a.slot - b.slot || (a.group ?? '').localeCompare(b.group ?? ''));
  const planned = new Map<string, M & { field: string; wave: number }>();
  for (let wave = firstWave; pending.length; wave++) {
    const busy = new Set<string>();
    let field = 0;
    for (let i = 0; i < pending.length && field < fields; ) {
      const m = pending[i];
      if ((m.homeId && busy.has(m.homeId)) || (m.awayId && busy.has(m.awayId))) {
        i++;
        continue;
      }
      if (m.homeId) busy.add(m.homeId);
      if (m.awayId) busy.add(m.awayId);
      planned.set(m.id, { ...m, field: `Feld ${++field}`, wave });
      pending.splice(i, 1);
    }
  }
  return matches.map((m) => planned.get(m.id)!);
}

/** Group sizes when `teams` are dealt evenly into `groups`. */
export const groupSizes = (teams: number, groups: number): number[] =>
  Array.from({ length: groups }, (_, g) => Math.floor(teams / groups) + (g < teams % groups ? 1 : 0));

/** Group matches (everyone against everyone) and the fewest waves they need on `fields`. */
export function groupPhase(teams: number, groups: number, fields: number): { matches: number; waves: number } {
  const sizes = groupSizes(teams, groups);
  const matches = sizes.reduce((sum, n) => sum + (n * (n - 1)) / 2, 0);
  // A group of n plays n-1 rounds (n even) or n rounds (n odd); per wave each field takes one match.
  const rounds = Math.max(0, ...sizes.map((n) => (n < 2 ? 0 : n % 2 ? n : n - 1)));
  return { matches, waves: Math.max(rounds, Math.ceil(matches / Math.max(1, fields))) };
}

/** server: TournamentHandlers.draw. Group counts the teams allow: at least 2 per group and enough to advance; 2 to 32 in the knockout. */
export function groupChoices(teams: number, advancePerGroup: number): number[] {
  return Array.from({ length: 8 }, (_, i) => i + 1).filter((g) => {
    const qualifiers = g * advancePerGroup;
    return qualifiers >= 2 && qualifiers <= 32 && (teams === 0 || teams >= Math.max(2 * g, qualifiers));
  });
}

/** One team over the whole tournament (group and knockout); `points` and `rank` come from its group table. */
export interface TeamStats extends Omit<StandingRow, 'points'> {
  group: string | null;
  rank: number | null;
  points: number | null;
  /** "Sieger", "2. Platz", "Aus im Halbfinale", "im Viertelfinale", "Aus in der Gruppe"; null before the knockout. */
  knockout: string | null;
}

type StatsInput = {
  status: string;
  format: TournamentFormat;
  teams: readonly { id: string; name: string; group: string | null }[];
  groups: readonly { label: string; standings: readonly { teamId: string; points: number }[] }[];
  matches: readonly {
    stage: string; round: number; homeId: string | null; awayId: string | null; homeScore: number | null; awayScore: number | null;
    sets: readonly { home: number; away: number }[];
  }[];
};

export function teamStats(t: StatsInput): TeamStats[] {
  const stats = new Map<string, TeamStats>(
    t.teams.map((team) => [team.id, { teamId: team.id, name: team.name, group: team.group, rank: null, played: 0, won: 0, drawn: 0, lost: 0,
      setsWon: 0, setsLost: 0, ballsWon: 0, ballsLost: 0, points: null, knockout: null }]),
  );
  for (const group of t.groups) {
    group.standings.forEach((row, i) => {
      const s = stats.get(row.teamId);
      if (s) Object.assign(s, { rank: i + 1, points: row.points });
    });
  }
  const simple = t.format === 'SIMPLE'; // a simple score is the outcome (1:0), not sets
  for (const m of t.matches) {
    if (!m.homeId || !m.awayId || m.homeScore === null || m.awayScore === null) continue;
    for (const [id, own, other, side] of [[m.homeId, m.homeScore, m.awayScore, 'home'], [m.awayId, m.awayScore, m.homeScore, 'away']] as const) {
      const s = stats.get(id);
      if (!s) continue;
      s.played++;
      if (own > other) s.won++;
      else if (own < other) s.lost++;
      else s.drawn++;
      if (!simple) {
        s.setsWon += own;
        s.setsLost += other;
      }
      for (const set of m.sets) {
        s.ballsWon += side === 'home' ? set.home : set.away;
        s.ballsLost += side === 'home' ? set.away : set.home;
      }
    }
  }
  const ko = t.matches.filter((m) => m.stage === 'KO');
  if (ko.length) {
    const rounds = Math.max(...ko.map((m) => m.round));
    for (const s of stats.values()) {
      const own = ko.filter((m) => m.homeId === s.teamId || m.awayId === s.teamId);
      if (!own.length) {
        s.knockout = 'Aus in der Gruppe';
        continue;
      }
      const last = own.reduce((a, b) => (b.round > a.round ? b : a));
      const name = roundName(last.round, rounds);
      const played = last.homeId && last.awayId && last.homeScore !== null && last.awayScore !== null;
      const lost = played && (last.homeId === s.teamId ? last.homeScore! < last.awayScore! : last.awayScore! < last.homeScore!);
      if (last.round === rounds && played) s.knockout = lost ? '2. Platz' : 'Sieger';
      else if (lost) s.knockout = name.startsWith('Runde') ? `Aus in ${name}` : `Aus im ${name}`;
      else s.knockout = name.startsWith('Runde') ? `in ${name}` : `im ${name}`;
    }
  }
  return [...stats.values()].sort((a, b) => (a.group ?? '~').localeCompare(b.group ?? '~') || (a.rank ?? 99) - (b.rank ?? 99) || a.name.localeCompare(b.name, 'de'));
}
