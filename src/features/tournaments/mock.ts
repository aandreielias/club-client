// Mock of the club-server tournaments module (TournamentHandlers): draw, group tables, knockout tree, guests.
import { directory, type MockDirectory } from '../../lib/mock/core';
import { MockServer, mockServer, type MockRequest } from '../../lib/mock/MockServer';
import { MockTable } from '../../lib/mock/MockTable';
import { guestOnly, MANAGERS, PRIVILEGED, type Member } from '../../lib/types';
import { firstRound, koRounds, roundRobin, seeds, standings } from './logic';
import type { Guest, NewTournament, ResultInput, TeamInput, Tournament, TournamentMatch, TournamentSummary, TournamentTeam } from './model';

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
  readonly guests = new MockTable<Record<string, StoredGuest>>('tournament-guests', () => ({ gast: { tournamentId: 'tm-herbst', teamId: 'tt-uvc' } }));

  constructor(private readonly people: MockDirectory) {}

  list(viewer: Member): { items: TournamentSummary[] } {
    const own = this.ownTournament(viewer);
    return {
      items: this.tournaments.data
        .filter((t) => own === null || t.id === own)
        .sort((a, b) => b.startsOn.localeCompare(a.startsOn))
        .map((t) => ({ id: t.id, name: t.name, startsOn: t.startsOn, endsOn: t.endsOn, status: t.status, teams: (this.teams.data[t.id] ?? []).length })),
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
      id: crypto.randomUUID(), name: body.name ?? '', startsOn: body.startsOn ?? '', endsOn: body.endsOn ?? '', locationId: body.locationId ?? null,
      appointmentId: body.appointmentId ?? null, groupCount: body.groupCount ?? 2, advancePerGroup: body.advancePerGroup ?? 2,
      pointsWin: body.pointsWin ?? 3, pointsDraw: body.pointsDraw ?? 1, status: 'DRAFT', createdAt: now,
    });
    this.tournaments.data.push(t);
    this.teams.data[t.id] = [];
    this.matches.data[t.id] = [];
    this.save(t.id, 'CREATED');
    return this.dto(viewer, t);
  }

  update(viewer: Member, id: string, patch: Partial<NewTournament>): Tournament {
    this.people.requirePrivileged(viewer, PRIVILEGED);
    const t = this.find(id);
    const settings = (['groupCount', 'advancePerGroup', 'pointsWin', 'pointsDraw'] as const).some((k) => patch[k] != null);
    if (settings && t.status !== 'DRAFT') fail(409, 'tournament.drawn');
    const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== null && v !== undefined));
    Object.assign(t, MockTournaments.validated({ ...t, ...defined }));
    this.save(id, 'UPDATED');
    return this.dto(viewer, t);
  }

  delete(viewer: Member, id: string): void {
    this.people.requirePrivileged(viewer, MANAGERS);
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
    if (!Array.isArray(inputs)) return fail(400, 'request.invalid');
    if (inputs.length > 64) fail(400, 'tournament.too-many-teams');
    const existing = new Set((this.teams.data[id] ?? []).map((team) => team.id));
    const names = new Set<string>();
    this.teams.data[id] = (inputs as TeamInput[]).map((input) => {
      const name = (input.name ?? '').trim();
      if (!name || name.length > 80) fail(400, 'tournament.team-name-invalid');
      if (names.has(name.toLowerCase())) fail(400, 'tournament.team-duplicate');
      names.add(name.toLowerCase());
      return { id: input.id && existing.has(input.id) ? input.id : crypto.randomUUID(), name, clubTeamId: input.clubTeamId ?? null, group: null };
    });
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
        matches.push({ id: crypto.randomUUID(), stage: 'GROUP', group: label(g), round: p.round, slot, homeId: p.home, awayId: p.away,
          homeScore: null, awayScore: null, startsAt: null, field: null }));
    }
    this.matches.data[id] = matches;
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
    const order = seeds(this.groups(t).map((g) => g.standings.map((s) => s.teamId)), t.advancePerGroup);
    const rounds = koRounds(order.length);
    const tree: TournamentMatch[] = firstRound(order).map((p) => MockTournaments.ko(1, p.slot, p.home, p.away));
    for (let round = 2; round <= rounds; round++) for (let slot = 0; slot < 2 ** (rounds - round); slot++) tree.push(MockTournaments.ko(round, slot, null, null));
    tree.filter((m) => m.round === 1 && m.homeId && !m.awayId).forEach((bye) => MockTournaments.advance(tree, bye));
    this.matches.data[id] = [...matches, ...tree];
    t.status = 'KO';
    this.save(id, 'UPDATED');
    return this.dto(viewer, t);
  }

  setResult(viewer: Member, id: string, matchId: string, body: Partial<ResultInput>): Tournament {
    this.people.requirePrivileged(viewer, PRIVILEGED);
    const t = this.find(id);
    const matches = this.matches.data[id] ?? [];
    const m = matches.find((x) => x.id === matchId) ?? fail(404, 'tournament.match-not-found');
    const home = body.homeScore ?? null;
    const away = body.awayScore ?? null;
    if ((home === null) !== (away === null) || (home !== null && (home < 0 || home > 999 || away! < 0 || away! > 999))) fail(400, 'tournament.score-invalid');
    const scoring = home !== m.homeScore || away !== m.awayScore;
    if (scoring) {
      if (!m.homeId || !m.awayId) fail(409, 'tournament.teams-open');
      if (m.stage === 'GROUP' && t.status !== 'GROUPS') fail(409, 'tournament.groups-closed');
      if (m.stage === 'KO' && home !== null && home === away) fail(400, 'tournament.ko-draw');
      if (m.stage === 'KO' && MockTournaments.next(matches, m)?.homeScore != null) fail(409, 'tournament.result-locked');
    }
    Object.assign(m, { homeScore: home, awayScore: away, startsAt: body.startsAt ?? m.startsAt, field: body.field?.trim() || null });
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
        standings: standings(new Map(teams.filter((team) => team.group === group).map((team) => [team.id, team.name])),
          matches.filter((m) => m.stage === 'GROUP' && m.group === group).map((m) => ({ home: m.homeId, away: m.awayId, homeScore: m.homeScore, awayScore: m.awayScore })),
          t.pointsWin, t.pointsDraw),
      }))
      .filter((g) => g.standings.length);
  }

  private dto(viewer: Member, t: StoredTournament): Tournament {
    const guests: Guest[] = this.people.hasRole(viewer, PRIVILEGED)
      ? Object.entries(this.guests.data)
        .filter(([, g]) => g.tournamentId === t.id)
        .map(([memberId, g]) => ({ memberId, name: this.people.name(memberId) ?? 'Gast', teamId: g.teamId,
          deletedOn: new Date(Date.parse(t.endsOn) + (GUEST_RETENTION_DAYS + 1) * 86_400_000).toISOString().slice(0, 10) }))
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
    const guests = Object.entries(this.guests.data).filter(([, g]) => g.tournamentId === id).map(([memberId]) => memberId);
    mockServer.events.publish({ type: 'tournaments.tournament-changed', data: { tournamentId: id, change }, audience: { everyone: true, members: guests } });
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
    next.awayScore = null;
  }

  private static ko(round: number, slot: number, homeId: string | null, awayId: string | null): TournamentMatch {
    return { id: crypto.randomUUID(), stage: 'KO', group: null, round, slot, homeId, awayId, homeScore: null, awayScore: null, startsAt: null, field: null };
  }

  /** server: Tournament constructor checks */
  private static validated(t: StoredTournament): StoredTournament {
    const name = t.name?.trim() ?? '';
    if (!name || name.length > 120) fail(400, 'tournament.name-invalid');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t.startsOn) || !/^\d{4}-\d{2}-\d{2}$/.test(t.endsOn) || t.endsOn < t.startsOn) fail(400, 'tournament.dates-invalid');
    if (t.groupCount < 1 || t.groupCount > 8) fail(400, 'tournament.groups-invalid');
    const qualifiers = t.groupCount * t.advancePerGroup;
    if (t.advancePerGroup < 1 || t.advancePerGroup > 4 || qualifiers < 2 || qualifiers > 32) fail(400, 'tournament.advance-invalid');
    if (t.pointsWin < 1 || t.pointsWin > 10 || t.pointsDraw < 0 || t.pointsDraw >= t.pointsWin) fail(400, 'tournament.points-invalid');
    return { ...t, name };
  }

  /** Herbstcup in three weeks: six teams drawn into two groups, some results in. */
  private static seed() {
    const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
    const names: [string, string, string | null][] = [
      ['tt-sdg1', 'SDG Damen 1', 't-damen'], ['tt-sdgu', 'SDG U16', 't-u16'], ['tt-uvc', 'UVC Graz', null],
      ['tt-tsv', 'TSV Seeblick', null], ['tt-ask', 'ASK Bergdorf', null], ['tt-vcm', 'VC Musterstadt', null],
    ];
    const teams: TournamentTeam[] = names.map(([id, name, clubTeamId], i) => ({ id, name, clubTeamId, group: i % 2 ? 'B' : 'A' }));
    const match = (id: string, group: string, round: number, slot: number, home: string, away: string, score: [number, number] | null): TournamentMatch =>
      ({ id, stage: 'GROUP', group, round, slot, homeId: home, awayId: away, homeScore: score?.[0] ?? null, awayScore: score?.[1] ?? null,
        startsAt: null, field: group === 'A' ? 'Feld 1' : 'Feld 2' });
    return {
      tournaments: [{ id: 'tm-herbst', name: 'Herbstcup 2026', startsOn: day(21), endsOn: day(21), locationId: 'l-west', appointmentId: null,
        groupCount: 2, advancePerGroup: 2, pointsWin: 3, pointsDraw: 1, status: 'GROUPS', createdAt: new Date().toISOString() } as StoredTournament],
      teams: { 'tm-herbst': teams },
      matches: {
        'tm-herbst': [
          match('tg-1', 'A', 1, 0, 'tt-sdg1', 'tt-ask', [2, 0]),
          match('tg-2', 'A', 2, 1, 'tt-uvc', 'tt-sdg1', [1, 2]),
          match('tg-3', 'A', 3, 2, 'tt-ask', 'tt-uvc', null),
          match('tg-4', 'B', 1, 0, 'tt-sdgu', 'tt-vcm', [0, 2]),
          match('tg-5', 'B', 2, 1, 'tt-tsv', 'tt-sdgu', null),
          match('tg-6', 'B', 3, 2, 'tt-vcm', 'tt-tsv', null),
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
  .on('PUT', '/api/v1/tournaments/:id/matches/:matchId', (req) => tournaments.setResult(actor(req), req.params.id, req.params.matchId, req.body ?? {}))
  .on('POST', '/api/v1/tournaments/:id/guests', (req) => tournaments.inviteGuest(actor(req), req.params.id, req.body ?? {}));
