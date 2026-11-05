// Mock of the club-server tournaments module (TournamentHandlers): draw, group tables, knockout tree, guests.
import { directory, type MockDirectory } from '../../lib/mock/core';
import { MockServer, mockServer, type MockRequest } from '../../lib/mock/MockServer';
import { MockTable } from '../../lib/mock/MockTable';
import { guestOnly, ADMIN_BOARD, PRIVILEGED, type Member } from '../../lib/types';
import { fieldPlan, firstRound, koRounds, roundRobin, seeds, setsProblem, standings, tally } from './logic';
import type { Guest, NewTournament, ResultInput, SetScore, TeamInput, Tournament, TournamentMatch, TournamentSummary, TournamentTeam } from './model';

const fail = MockServer.fail;
const GUEST_RETENTION_DAYS = 30;

type StoredTournament = Omit<Tournament, 'teams' | 'groups' | 'matches' | 'guests'> & { createdAt: string };
type StoredGuest = { tournamentId: string; teamId: string | null };

const label = (index: number) => String.fromCharCode(65 + index);

export class MockTournaments {
  readonly tournaments = new MockTable<StoredTournament[]>('tournaments', () => MockTournaments.seed().tournaments);
  readonly teams = new MockTable<Record<string, TournamentTeam[]>>('tournament-teams', () => MockTournaments.seed().teams);
  readonly matches = new MockTable<Record<string, TournamentMatch[]>>('tournament-matches', () => MockTournaments.seed().matches);
  /** memberId → guest of which tournament */
  readonly guests = new MockTable<Record<string, StoredGuest>>('tournament-guests', () => ({ ...MockTournaments.SEED_GUESTS }));

  /** One guest login per seeded tournament (members in MockDirectory). */
  private static readonly SEED_GUESTS: Readonly<Record<string, StoredGuest>> = {
    gast: { tournamentId: 'tm-herbst', teamId: 'tt-uvc' },
    'gast-sommer': { tournamentId: 'tm-sommer', teamId: 'tm-sommer-t2' },
    'gast-fruehling': { tournamentId: 'tm-fruehling', teamId: 'tm-fruehling-t1' },
  };

  constructor(private readonly people: MockDirectory) {
    this.upgradeStored();
    this.addMissingSeeds();
  }

  /** Browsers that stored mock data before a seed tournament existed get it too (their own data stays). */
  private addMissingSeeds(): void {
    const seed = MockTournaments.seed();
    let changed = false;
    for (const t of seed.tournaments) {
      if (this.tournaments.data.some((x) => x.id === t.id)) continue;
      this.tournaments.data.push(t);
      this.teams.data[t.id] = seed.teams[t.id];
      this.matches.data[t.id] = seed.matches[t.id];
      changed = true;
    }
    for (const [memberId, guest] of Object.entries(MockTournaments.SEED_GUESTS)) {
      if (this.guests.data[memberId] || !this.tournaments.data.some((t) => t.id === guest.tournamentId)) continue;
      this.guests.data[memberId] = guest;
      changed = true;
    }
    if (!changed) return;
    this.tournaments.save();
    this.teams.save();
    this.matches.save();
    this.guests.save();
  }

  list(viewer: Member): { items: TournamentSummary[] } {
    const own = this.ownTournament(viewer);
    return {
      items: this.tournaments.data
        .filter((t) => own === null || t.id === own)
        .sort((a, b) => b.startsOn.localeCompare(a.startsOn))
        .map((t) => ({
          id: t.id,
          name: t.name,
          startsOn: t.startsOn,
          endsOn: t.endsOn,
          status: t.status,
          teams: (this.teams.data[t.id] ?? []).length,
        })),
    };
  }

  get(viewer: Member, id: string): Tournament {
    const own = this.ownTournament(viewer);
    if (own !== null && own !== id) fail(404, 'tournament.not-found');
    return this.dto(viewer, this.find(id));
  }

  create(viewer: Member, body: Partial<NewTournament>): Tournament {
    this.people.requirePrivileged(viewer, PRIVILEGED);
    const now = new Date().toISOString();
    const t = MockTournaments.validated({
      id: crypto.randomUUID(),
      name: body.name ?? '',
      startsOn: body.startsOn ?? '',
      endsOn: body.endsOn ?? '',
      locationId: body.locationId ?? null,
      appointmentId: body.appointmentId ?? null,
      groupCount: body.groupCount ?? 2,
      advancePerGroup: body.advancePerGroup ?? 2,
      format: body.format ?? 'VOLLEYBALL',
      setsToWin: body.setsToWin ?? 2,
      teamSize: body.teamSize ?? null,
      fieldCount: body.fieldCount ?? 1,
      status: 'DRAFT',
      createdAt: now,
    });
    // server: teams entered with the tournament are checked first, so a bad name leaves nothing behind
    const teams = MockTournaments.teamsFrom(body.teams ?? [], new Set());
    this.tournaments.data.push(t);
    this.teams.data[t.id] = teams;
    this.matches.data[t.id] = [];
    this.save(t.id, 'CREATED');
    return this.dto(viewer, t);
  }

  update(viewer: Member, id: string, patch: Partial<NewTournament>): Tournament {
    this.people.requirePrivileged(viewer, PRIVILEGED);
    const t = this.find(id);
    const settings = (['groupCount', 'advancePerGroup', 'format', 'setsToWin', 'teamSize', 'fieldCount'] as const).some((k) => patch[k] != null);
    if (settings && t.status !== 'DRAFT') fail(409, 'tournament.drawn');
    const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== null && v !== undefined));
    // server: a new format brings its own default team size
    if (patch.format && patch.format !== t.format && patch.teamSize == null) defined.teamSize = null;
    Object.assign(t, MockTournaments.validated({ ...t, ...defined }));
    this.save(id, 'UPDATED');
    return this.dto(viewer, t);
  }

  delete(viewer: Member, id: string): void {
    this.people.requirePrivileged(viewer, ADMIN_BOARD);
    const t = this.find(id);
    this.tournaments.data.splice(this.tournaments.data.indexOf(t), 1);
    delete this.teams.data[id];
    delete this.matches.data[id];
    this.save(id, 'DELETED');
  }

  setTeams(viewer: Member, id: string, inputs: unknown): Tournament {
    this.people.requirePrivileged(viewer, PRIVILEGED);
    const t = this.find(id);
    if (t.status !== 'DRAFT') fail(409, 'tournament.drawn');
    this.teams.data[id] = MockTournaments.teamsFrom(inputs, new Set((this.teams.data[id] ?? []).map((team) => team.id)));
    this.save(id, 'UPDATED');
    return this.dto(viewer, t);
  }

  draw(viewer: Member, id: string): Tournament {
    this.people.requirePrivileged(viewer, PRIVILEGED);
    const t = this.find(id);
    if (t.status !== 'DRAFT') fail(409, 'tournament.drawn');
    const teams = this.teams.data[id] ?? [];
    if (teams.length < Math.max(t.groupCount * 2, t.groupCount * t.advancePerGroup)) fail(400, 'tournament.too-few-teams');
    const shuffled = [...teams].sort(() => Math.random() - 0.5);
    shuffled.forEach((team, i) => (team.group = label(i % t.groupCount)));
    const matches: TournamentMatch[] = [];
    for (let g = 0; g < t.groupCount; g++) {
      const members = teams.filter((team) => team.group === label(g)).map((team) => team.id);
      roundRobin(members).forEach((p, slot) =>
        matches.push({
          id: crypto.randomUUID(),
          stage: 'GROUP',
          group: label(g),
          round: p.round,
          slot,
          homeId: p.home,
          awayId: p.away,
          homeScore: null,
          awayScore: null,
          sets: [],
          startsAt: null,
          field: null,
          wave: null,
        }),
      );
    }
    this.matches.data[id] = fieldPlan(matches, t.fieldCount, 1);
    t.status = 'GROUPS';
    this.save(id, 'UPDATED');
    return this.dto(viewer, t);
  }

  startKnockout(viewer: Member, id: string): Tournament {
    this.people.requirePrivileged(viewer, PRIVILEGED);
    const t = this.find(id);
    if (t.status !== 'GROUPS') fail(409, 'tournament.not-in-groups');
    const matches = this.matches.data[id] ?? [];
    if (matches.some((m) => m.stage === 'GROUP' && m.homeScore === null)) fail(409, 'tournament.groups-open');
    const order = seeds(
      this.groups(t).map((g) => g.standings.map((s) => s.teamId)),
      t.advancePerGroup,
    );
    const rounds = koRounds(order.length);
    const tree: TournamentMatch[] = firstRound(order).map((p) => MockTournaments.ko(1, p.slot, p.home, p.away));
    for (let round = 2; round <= rounds; round++)
      for (let slot = 0; slot < 2 ** (rounds - round); slot++) tree.push(MockTournaments.ko(round, slot, null, null));
    tree.filter((m) => m.round === 1 && m.homeId && !m.awayId).forEach((bye) => MockTournaments.advance(tree, bye));
    // server: planKnockout, round by round after the last group wave; byes get no field
    let wave = Math.max(0, ...matches.map((m) => m.wave ?? 0)) + 1;
    const planned = new Map<string, TournamentMatch>();
    for (let round = 1; round <= rounds; round++) {
      const playing = tree.filter((m) => m.round === round && (round > 1 || (m.homeId && m.awayId)));
      fieldPlan(playing, t.fieldCount, wave).forEach((m) => planned.set(m.id, m));
      wave = Math.max(wave, ...[...planned.values()].map((m) => (m.wave ?? 0) + 1));
    }
    this.matches.data[id] = [...matches, ...tree.map((m) => planned.get(m.id) ?? m)];
    t.status = 'KO';
    this.save(id, 'UPDATED');
    return this.dto(viewer, t);
  }

  setResult(viewer: Member, id: string, matchId: string, body: Partial<ResultInput>): Tournament {
    this.people.requirePrivileged(viewer, PRIVILEGED);
    const t = this.find(id);
    const matches = this.matches.data[id] ?? [];
    const m = matches.find((x) => x.id === matchId) ?? fail(404, 'tournament.match-not-found');
    const sets = Array.isArray(body.sets) ? body.sets : [];
    if (sets.length > 5) fail(400, 'tournament.too-many-sets');
    for (const s of sets) {
      if (![s.home, s.away].every((p) => Number.isInteger(p) && p >= 0 && p <= 99) || s.home === s.away) fail(400, 'tournament.set-invalid');
    }
    const outcome = body.outcome ?? null;
    if (t.format === 'SIMPLE' && sets.length) fail(400, 'tournament.sets-not-noted');
    if (t.format !== 'SIMPLE' && outcome) fail(400, 'tournament.sets-needed');
    const problem = t.format === 'SIMPLE' ? null : setsProblem(sets, t.setsToWin, t.format);
    if (problem) fail(400, problem.code);
    // A simple match keeps only the outcome: 1:0, 0:1 or 0:0 for a draw.
    const { homeSets: home, awaySets: away } = outcome ? { homeSets: Number(outcome === 'HOME'), awaySets: Number(outcome === 'AWAY') } : tally(sets);
    const scoring = JSON.stringify(sets) !== JSON.stringify(m.sets) || home !== m.homeScore || away !== m.awayScore;
    if (scoring) {
      if (!m.homeId || !m.awayId) fail(409, 'tournament.teams-open');
      if (m.stage === 'GROUP' && t.status !== 'GROUPS') fail(409, 'tournament.groups-closed');
      if (m.stage === 'KO' && home !== null && home === away) fail(400, 'tournament.ko-draw');
      if (m.stage === 'KO' && MockTournaments.next(matches, m)?.homeScore != null) fail(409, 'tournament.result-locked');
    }
    Object.assign(m, {
      homeScore: home,
      awayScore: away,
      sets: sets.map((s) => ({ home: s.home, away: s.away })),
      startsAt: body.startsAt ?? m.startsAt,
      field: body.field?.trim() || null,
    });
    if (m.stage === 'KO' && scoring) MockTournaments.advance(matches, m);
    const rounds = Math.max(0, ...matches.filter((x) => x.stage === 'KO').map((x) => x.round));
    const finalPlayed = matches.some((x) => x.stage === 'KO' && x.round === rounds && MockTournaments.winner(x));
    if (t.status === 'KO' && finalPlayed) t.status = 'DONE';
    else if (t.status === 'DONE' && !finalPlayed) t.status = 'KO';
    this.save(id, 'UPDATED');
    return this.dto(viewer, t);
  }

  inviteGuest(viewer: Member, id: string, body: Record<string, unknown>): Tournament {
    const t = this.find(id);
    if (body.teamId && !(this.teams.data[id] ?? []).some((team) => team.id === body.teamId)) fail(400, 'tournament.team-unknown');
    const guest = this.people.invite(viewer, { ...body, roles: ['GUEST'] });
    this.guests.data[guest.id] = { tournamentId: t.id, teamId: (body.teamId as string) ?? null };
    this.guests.save();
    this.save(id, 'UPDATED');
    return this.dto(viewer, t);
  }

  private ownTournament(viewer: Member): string | null {
    return guestOnly(viewer.roles) ? (this.guests.data[viewer.id]?.tournamentId ?? '-') : null;
  }

  private groups(t: StoredTournament) {
    const teams = this.teams.data[t.id] ?? [];
    const matches = this.matches.data[t.id] ?? [];
    return Array.from({ length: t.groupCount }, (_, g) => label(g))
      .map((group) => ({
        label: group,
        standings: standings(
          new Map(teams.filter((team) => team.group === group).map((team) => [team.id, team.name])),
          matches
            .filter((m) => m.stage === 'GROUP' && m.group === group)
            .map((m) => ({ home: m.homeId, away: m.awayId, ...tally(m.sets), homeSets: m.homeScore, awaySets: m.awayScore })),
          t.format,
        ),
      }))
      .filter((g) => g.standings.length);
  }

  private dto(viewer: Member, t: StoredTournament): Tournament {
    const guests: Guest[] = this.people.hasRole(viewer, PRIVILEGED)
      ? Object.entries(this.guests.data)
          .filter(([, g]) => g.tournamentId === t.id)
          .map(([memberId, g]) => ({
            memberId,
            name: this.people.name(memberId) ?? 'Gast',
            teamId: g.teamId,
            deletedOn: new Date(Date.parse(t.endsOn) + (GUEST_RETENTION_DAYS + 1) * 86_400_000).toISOString().slice(0, 10),
          }))
      : [];
    const { createdAt: _, ...rest } = t;
    return { ...rest, teams: this.teams.data[t.id] ?? [], groups: this.groups(t), matches: this.matches.data[t.id] ?? [], guests };
  }

  private find(id: string): StoredTournament {
    return this.tournaments.data.find((t) => t.id === id) ?? fail(404, 'tournament.not-found');
  }

  private save(id: string, change: string): void {
    this.tournaments.save();
    this.teams.save();
    this.matches.save();
    const guests = Object.entries(this.guests.data)
      .filter(([, g]) => g.tournamentId === id)
      .map(([memberId]) => memberId);
    mockServer.events.publish({
      type: 'tournaments.tournament-changed',
      data: { tournamentId: id, change },
      audience: { everyone: true, members: guests },
    });
  }

  private static winner(m: TournamentMatch): string | null {
    if (m.homeId && !m.awayId) return m.homeId;
    if (m.homeScore === null || m.awayScore === null) return null;
    return m.homeScore > m.awayScore ? m.homeId : m.awayScore > m.homeScore ? m.awayId : null;
  }

  private static next(matches: readonly TournamentMatch[], m: TournamentMatch): TournamentMatch | undefined {
    return matches.find((x) => x.stage === 'KO' && x.round === m.round + 1 && x.slot === Math.floor(m.slot / 2));
  }

  /** The winner moves on (or the slot empties again when a result is removed). */
  private static advance(matches: TournamentMatch[], m: TournamentMatch): void {
    const next = MockTournaments.next(matches, m);
    if (!next) return;
    if (m.slot % 2 === 0) next.homeId = MockTournaments.winner(m);
    else next.awayId = MockTournaments.winner(m);
    next.homeScore = null;
    next.sets = [];
    next.awayScore = null;
  }

  /** Sets and the sets won they give. */
  private static scores(sets: SetScore[]): Pick<TournamentMatch, 'sets' | 'homeScore' | 'awayScore'> {
    const { homeSets, awaySets } = tally(sets);
    return { sets, homeScore: homeSets, awayScore: awaySets };
  }

  /**
   * Data a browser stored under older rules: tournaments get best of 3, and matches without valid sets get sets that
   * give the same result by the rules (or lose a result no volleyball match can have).
   */
  private upgradeStored(): void {
    let changed = false;
    for (const t of this.tournaments.data.filter((x) => !x.setsToWin || !x.format)) {
      Object.assign(t, { setsToWin: t.setsToWin ?? 2, format: 'VOLLEYBALL', teamSize: 6, pointsWin: undefined, pointsDraw: undefined });
      changed = true;
    }
    for (const t of this.tournaments.data.filter((x) => x.format !== 'SIMPLE')) {
      for (const m of (this.matches.data[t.id] ?? []).filter((x) => !Array.isArray(x.sets) || setsProblem(x.sets, t.setsToWin, t.format))) {
        Object.assign(m, MockTournaments.scores(MockTournaments.setsFor(m.homeScore, m.awayScore, t.setsToWin)));
        changed = true;
      }
    }
    if (changed) {
      this.tournaments.save();
      this.matches.save();
    }
  }

  /** Sets by the rules for a score in sets: the loser's first, so the winner takes the last; none for an impossible score. */
  private static setsFor(home: number | null, away: number | null, setsToWin: number): SetScore[] {
    if (home === null || away === null || Math.max(home, away) !== setsToWin || Math.min(home, away) >= setsToWin) return [];
    return Array.from({ length: home + away }, (_, i) => {
      const homeTakes = i < Math.min(home, away) ? home < away : home > away;
      const [win, lose] = i === 2 * setsToWin - 2 ? [15, 10] : [25, 20];
      return homeTakes ? { home: win, away: lose } : { home: lose, away: win };
    });
  }

  /** server: TournamentHandlers.teamsFrom */
  private static teamsFrom(inputs: unknown, existing: ReadonlySet<string>): TournamentTeam[] {
    if (!Array.isArray(inputs)) return fail(400, 'request.invalid');
    if (inputs.length > 64) fail(400, 'tournament.too-many-teams');
    const names = new Set<string>();
    return (inputs as TeamInput[]).map((input) => {
      const name = (input.name ?? '').trim();
      if (!name || name.length > 80) fail(400, 'tournament.team-name-invalid');
      if (names.has(name.toLowerCase())) fail(400, 'tournament.team-duplicate');
      names.add(name.toLowerCase());
      return { id: input.id && existing.has(input.id) ? input.id : crypto.randomUUID(), name, clubTeamId: input.clubTeamId ?? null, group: null };
    });
  }

  private static ko(round: number, slot: number, homeId: string | null, awayId: string | null): TournamentMatch {
    return {
      id: crypto.randomUUID(),
      stage: 'KO',
      group: null,
      round,
      slot,
      homeId,
      awayId,
      homeScore: null,
      awayScore: null,
      sets: [],
      startsAt: null,
      field: null,
      wave: null,
    };
  }

  /** server: Tournament constructor checks */
  private static validated(t: StoredTournament): StoredTournament {
    const name = t.name?.trim() ?? '';
    if (!name || name.length > 120) fail(400, 'tournament.name-invalid');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t.startsOn) || !/^\d{4}-\d{2}-\d{2}$/.test(t.endsOn) || t.endsOn < t.startsOn)
      fail(400, 'tournament.dates-invalid');
    if (t.groupCount < 1 || t.groupCount > 8) fail(400, 'tournament.groups-invalid');
    const qualifiers = t.groupCount * t.advancePerGroup;
    if (t.advancePerGroup < 1 || t.advancePerGroup > 4 || qualifiers < 2 || qualifiers > 32) fail(400, 'tournament.advance-invalid');
    // server: Tournament constructor normalizes per format
    const format = t.format ?? 'VOLLEYBALL';
    const setsToWin = format === 'VOLLEYBALL' ? t.setsToWin : 2;
    const teamSize = format === 'VOLLEYBALL' ? 6 : format === 'BEACH' ? (t.teamSize ?? 2) : null;
    if (setsToWin !== 2 && setsToWin !== 3) fail(400, 'tournament.sets-invalid');
    if (teamSize !== null && (teamSize < 2 || teamSize > (format === 'BEACH' ? 4 : 6))) fail(400, 'tournament.team-size-invalid');
    const fieldCount = t.fieldCount ?? 1; // stored before fields existed
    if (fieldCount < 1 || fieldCount > 16) fail(400, 'tournament.fields-invalid');
    return { ...t, name, format, setsToWin, teamSize, fieldCount };
  }

  /**
   * A tournament whose group phase is fully played (`finished`: the knockout too). The team listed first in a group
   * is the strongest; every third match goes to a deciding set. Built with the mock's own rules, so tables and
   * bracket match what the app computes.
   */
  private static played(id: string, name: string, on: string, finished: boolean, groupNames: string[][]) {
    const teams: TournamentTeam[] = groupNames.flatMap((names, g) =>
      names.map((teamName, i) => ({
        id: `${id}-t${g * 10 + i}`,
        name: teamName,
        clubTeamId: teamName === 'Damen 1' ? 't-damen' : teamName === 'U16' ? 't-u16' : null,
        group: label(g),
      })),
    );
    const strength = (teamId: string) => teams.findIndex((t) => t.id === teamId) % 10; // lower index in its group: stronger
    let count = 0;
    const result = (home: string, away: string, homeStronger: boolean): Pick<TournamentMatch, 'sets' | 'homeScore' | 'awayScore'> => {
      const close = ++count % 3 === 0;
      const won: [number, number][] = close
        ? [
            [25, 23],
            [21, 25],
            [15, 12],
          ]
        : [
            [25, 19],
            [25, 21],
          ];
      return MockTournaments.scores(won.map(([w, l]) => (homeStronger ? { home: w, away: l } : { home: l, away: w })));
    };
    const group: TournamentMatch[] = groupNames.flatMap((_, g) => {
      const members = teams.filter((t) => t.group === label(g)).map((t) => t.id);
      return roundRobin(members).map((p, slot) => ({
        id: `${id}-g${g}-${slot}`,
        stage: 'GROUP' as const,
        group: label(g),
        round: p.round,
        slot,
        homeId: p.home,
        awayId: p.away,
        ...result(p.home, p.away, strength(p.home) < strength(p.away)),
        startsAt: null,
        field: null,
        wave: null,
      }));
    });
    const fieldCount = 2;
    let matches: TournamentMatch[] = fieldPlan(group, fieldCount, 1);
    if (finished) {
      const ranked = groupNames.map((_, g) =>
        standings(
          new Map(teams.filter((t) => t.group === label(g)).map((t) => [t.id, t.name])),
          matches
            .filter((m) => m.group === label(g))
            .map((m) => ({ home: m.homeId, away: m.awayId, ...tally(m.sets), homeSets: m.homeScore, awaySets: m.awayScore })),
          'VOLLEYBALL',
        ).map((s) => s.teamId),
      );
      const order = seeds(ranked, 2);
      const rounds = koRounds(order.length);
      const tree: TournamentMatch[] = firstRound(order).map((p) => MockTournaments.ko(1, p.slot, p.home, p.away));
      for (let round = 2; round <= rounds; round++)
        for (let slot = 0; slot < 2 ** (rounds - round); slot++) tree.push(MockTournaments.ko(round, slot, null, null));
      let wave = Math.max(...matches.map((m) => m.wave ?? 0)) + 1;
      for (let round = 1; round <= rounds; round++) {
        for (const m of tree.filter((x) => x.round === round)) {
          // In the knockout the better seed wins, except one upset in the first round.
          const homeStronger = order.indexOf(m.homeId!) < order.indexOf(m.awayId!) !== (round === 1 && m.slot === 1);
          Object.assign(m, result(m.homeId!, m.awayId!, homeStronger));
          MockTournaments.advance(tree, m);
        }
        const planned = fieldPlan(
          tree.filter((x) => x.round === round),
          fieldCount,
          wave,
        );
        planned.forEach((p) =>
          Object.assign(
            tree.find((x) => x.id === p.id)!,
            { field: p.field, wave: p.wave },
          ),
        );
        wave = Math.max(...planned.map((p) => p.wave)) + 1;
      }
      matches = [...matches, ...tree];
    }
    const tournament = {
      id,
      name,
      startsOn: on,
      endsOn: on,
      locationId: 'l-west',
      appointmentId: null,
      groupCount: groupNames.length,
      advancePerGroup: 2,
      format: 'VOLLEYBALL',
      setsToWin: 2,
      teamSize: 6,
      fieldCount,
      status: finished ? 'DONE' : 'GROUPS',
      createdAt: new Date().toISOString(),
    } as StoredTournament;
    return { tournament, teams, matches };
  }

  /** Herbstcup in three weeks: six teams drawn into two groups, some results in. */
  private static seed(): { tournaments: StoredTournament[]; teams: Record<string, TournamentTeam[]>; matches: Record<string, TournamentMatch[]> } {
    const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
    const names: [string, string, string | null][] = [
      ['tt-sdg1', 'Damen 1', 't-damen'],
      ['tt-sdgu', 'U16', 't-u16'],
      ['tt-uvc', 'UVC Graz', null],
      ['tt-tsv', 'TSV Seeblick', null],
      ['tt-ask', 'ASK Bergdorf', null],
      ['tt-vcm', 'VC Musterstadt', null],
    ];
    const teams: TournamentTeam[] = names.map(([id, name, clubTeamId], i) => ({ id, name, clubTeamId, group: i % 2 ? 'B' : 'A' }));
    const match = (
      id: string,
      group: string,
      round: number,
      slot: number,
      home: string,
      away: string,
      sets: [number, number][],
    ): TournamentMatch => ({
      id,
      stage: 'GROUP',
      group,
      round,
      slot,
      homeId: home,
      awayId: away,
      ...MockTournaments.scores(sets.map(([h, a]) => ({ home: h, away: a }))),
      startsAt: null,
      field: group === 'A' ? 'Feld 1' : 'Feld 2',
      wave: round,
    });
    const sommer = MockTournaments.played('tm-sommer', 'Sommerturnier 2026', day(-7), true, [
      ['Damen 1', 'UVC Graz', 'TSV Seeblick', 'ASK Bergdorf'],
      ['VC Musterstadt', 'U16', 'SV Talheim', 'VBC Ostend'],
    ]);
    const fruehling = MockTournaments.played('tm-fruehling', 'Frühlingscup 2026', day(-1), false, [
      ['UVC Graz', 'Damen 1', 'SV Talheim'],
      ['TSV Seeblick', 'VC Musterstadt', 'ASK Bergdorf'],
    ]);
    return {
      tournaments: [
        {
          id: 'tm-herbst',
          name: 'Herbstcup 2026',
          startsOn: day(21),
          endsOn: day(21),
          locationId: 'l-west',
          appointmentId: null,
          groupCount: 2,
          advancePerGroup: 2,
          format: 'VOLLEYBALL',
          setsToWin: 2,
          teamSize: 6,
          fieldCount: 2,
          status: 'GROUPS',
          createdAt: new Date().toISOString(),
        } as StoredTournament,
        sommer.tournament,
        fruehling.tournament,
      ],
      teams: { 'tm-herbst': teams, 'tm-sommer': sommer.teams, 'tm-fruehling': fruehling.teams },
      matches: {
        'tm-sommer': sommer.matches,
        'tm-fruehling': fruehling.matches,
        'tm-herbst': [
          match('tg-1', 'A', 1, 0, 'tt-sdg1', 'tt-ask', [
            [25, 18],
            [25, 21],
          ]),
          match('tg-2', 'A', 2, 1, 'tt-uvc', 'tt-sdg1', [
            [25, 23],
            [19, 25],
            [12, 15],
          ]),
          match('tg-3', 'A', 3, 2, 'tt-ask', 'tt-uvc', []),
          match('tg-4', 'B', 1, 0, 'tt-sdgu', 'tt-vcm', [
            [22, 25],
            [20, 25],
          ]),
          match('tg-5', 'B', 2, 1, 'tt-tsv', 'tt-sdgu', []),
          match('tg-6', 'B', 3, 2, 'tt-vcm', 'tt-tsv', []),
        ],
      },
    };
  }
}

export const tournaments = new MockTournaments(directory);

const actor = (req: MockRequest) => directory.actor(req);

mockServer
  .on('GET', '/api/v1/tournaments', (req) => tournaments.list(actor(req)))
  .on('POST', '/api/v1/tournaments', (req) => tournaments.create(actor(req), req.body ?? {}))
  .on('GET', '/api/v1/tournaments/:id', (req) => tournaments.get(actor(req), req.params.id))
  .on('PATCH', '/api/v1/tournaments/:id', (req) => tournaments.update(actor(req), req.params.id, req.body ?? {}))
  .on('DELETE', '/api/v1/tournaments/:id', (req) => tournaments.delete(actor(req), req.params.id))
  .on('PUT', '/api/v1/tournaments/:id/teams', (req) => tournaments.setTeams(actor(req), req.params.id, req.body?.teams))
  .on('POST', '/api/v1/tournaments/:id/draw', (req) => tournaments.draw(actor(req), req.params.id))
  .on('POST', '/api/v1/tournaments/:id/knockout', (req) => tournaments.startKnockout(actor(req), req.params.id))
  .on('PUT', '/api/v1/tournaments/:id/matches/:matchId', (req) =>
    tournaments.setResult(actor(req), req.params.id, req.params.matchId, req.body ?? {}),
  )
  .on('POST', '/api/v1/tournaments/:id/guests', (req) => tournaments.inviteGuest(actor(req), req.params.id, req.body ?? {}));
