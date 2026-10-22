// Mock of the club-server core: club facts, members, teams, wards, PIN and step-up.
// Rules mirror the server's members and teams modules closely enough to exercise every client flow.
import { settings } from '../../settings';
import { ZonedClock } from '../time/ZonedClock';
import {
  ADMIN_BOARD,
  PRIVILEGED,
  guestOnly,
  type Club,
  canVote,
  type Member,
  type MemberList,
  type MembershipType,
  type MissingProfileField,
  type Role,
  type Roster,
  type SecurityStatus,
  type StepUp,
  type Team,
  type TeamRole,
} from '../types';
import { MockEventBus, type MockAudience } from './MockEventBus';
import { MockServer, mockServer, type MockRequest } from './MockServer';
import { MockTable } from './MockTable';

/** Per member: wrong club-PIN tries and the current step-up (server: members_pin_lock, step-ups). */
interface PinState {
  attempts: number;
  stepUpUntil: string | null;
}

export interface DevAccount {
  email: string;
  name: string;
  roles: Role[];
}

const fail = MockServer.fail;

function seedMember(id: string, firstName: string, lastName: string, roles: Role[], birthDate: string | null,
  membershipType: MembershipType | null = null, honorary = false): Member {
  return {
    id, email: `${id}@example.at`, firstName, lastName, birthDate, phone: null, photoConsent: true, active: true, roles,
    membershipType, honorary, memberSince: membershipType || honorary ? '2024-09-01' : null,
  };
}

const seedOffice = (id: string, memberId: string, office: OfficeRow['office']): OfficeRow =>
  ({ id, memberId, office, startsOn: '2024-09-01', termEndsOn: '2027-09-01', endedOn: null, coopted: false });

/** Bump when the seed changes in a way stored mock data should pick up (see MockDirectory.upgradeSeed). */
const SEED_VERSION = 2;

/** server: members_office; mirrors BoardRules (one per function, two auditors outside the board, deputy combines). */
interface OfficeRow {
  id: string;
  memberId: string;
  office: 'CHAIR' | 'VICE_CHAIR' | 'TREASURER' | 'SECRETARY' | 'BOARD_MEMBER' | 'AUDITOR';
  startsOn: string;
  termEndsOn: string;
  endedOn: string | null;
  coopted: boolean;
}

const OFFICES = ['CHAIR', 'VICE_CHAIR', 'TREASURER', 'SECRETARY', 'BOARD_MEMBER', 'AUDITOR'] as const;
const SINGLE_OFFICES: readonly string[] = ['CHAIR', 'VICE_CHAIR', 'TREASURER', 'SECRETARY'];
const plusYears = (date: string, years: number): string => `${Number(date.slice(0, 4)) + years}${date.slice(4)}`;

/** Members, teams and security state of the mock club, plus the server's authorization helpers. */
export class MockDirectory {
  /** The seeded club PIN; shown on the dev login page. */
  static readonly PIN = '73915';

  readonly club: Club = {
    name: 'Soli Deo Gloria',
    shortName: 'SDG',
    sport: 'Volleyball',
    country: 'AT',
    timeZone: 'Europe/Vienna',
    locale: 'de-AT',
    website: null,
    contactEmail: null,
  };

  readonly clock = new ZonedClock(this.club.timeZone);

  readonly teams = new MockTable<Team[]>('teams', () => [
    { id: 't-damen', name: 'Damen 1', season: '2026/27' },
    { id: 't-u16', name: 'U16', season: '2026/27' },
  ]);

  readonly members = new MockTable<Member[]>('members', () => MockDirectory.seedMembers());

  private static seedMembers(): Member[] {
    return [
      seedMember('admin', 'Anna', 'Admin', ['ADMIN'], '1985-03-12', 'EXTRAORDINARY'),
      seedMember('vorstand', 'Bernd', 'Vorstand', ['BOARD'], '1978-11-02', 'EXTRAORDINARY'),
      seedMember('trainer', 'Clara', 'Trainer', ['COACH', 'PLAYER'], '1992-06-30', 'EXTRAORDINARY'),
      // Minor without photo consent: photos tagged with him are hidden from everyone but managers.
      { ...seedMember('spieler', 'David', 'Spieler', ['PLAYER'], '2010-01-20', 'ORDINARY'), photoConsent: false },
      seedMember('spielerin', 'Lena', 'Spielerin', ['PLAYER'], '1998-08-08', 'ORDINARY'),
      // Parent of a player who helps run the club: extraordinary member.
      seedMember('eltern', 'Eva', 'Eltern', ['PARENT'], '1980-09-14', 'EXTRAORDINARY'),
      seedMember('neu', 'Felix', 'Neu', ['PLAYER'], null, 'ORDINARY'),
      // The rest of the board (five people with Bernd) and the second auditor.
      seedMember('kassier', 'Karin', 'Kassier', ['PLAYER', 'BOARD'], '1988-04-21', 'EXTRAORDINARY'),
      seedMember('schrift', 'Simon', 'Schrift', ['VOLUNTEER', 'BOARD'], '1990-02-11', 'EXTRAORDINARY'),
      seedMember('beisitz', 'Maria', 'Beisitz', ['VOLUNTEER', 'BOARD'], '1975-07-03', 'EXTRAORDINARY'),
      seedMember('beisitz2', 'Oskar', 'Ott', ['PLAYER', 'BOARD'], '1995-12-24', 'EXTRAORDINARY'),
      seedMember('pruefer', 'Peter', 'Prüfer', ['VOLUNTEER'], '1969-05-30', 'EXTRAORDINARY'),
      // Honorary member only (votes, §8 Abs 1).
      seedMember('ehren', 'Hans', 'Ehren', ['VOLUNTEER'], '1950-01-15', null, true),
      seedMember('helfer', 'Julia', 'Helfer', ['VOLUNTEER'], '1993-09-09', 'EXTRAORDINARY'),
      seedMember('helfer2', 'Tobias', 'Tausend', ['VOLUNTEER', 'PARENT'], '1982-03-03', 'EXTRAORDINARY'),
      // Ordinary members: take part, do not vote.
      seedMember('mia', 'Mia', 'Muster', ['PLAYER'], '2001-06-06', 'ORDINARY'),
      seedMember('noah', 'Noah', 'Netz', ['PLAYER'], '1999-10-10', 'ORDINARY'),
      seedMember('sara', 'Sara', 'Satz', ['PLAYER'], '2009-04-04', 'ORDINARY'),
      seedMember('leon', 'Leon', 'Lob', ['PLAYER'], '2000-11-11', 'ORDINARY'),
      // Temporary accounts of visiting teams: each sees only its tournament.
      seedMember('gast', 'Gerd', 'Gast', ['GUEST'], null), // Herbstcup (group phase running)
      seedMember('gast-sommer', 'Sven', 'Sommer', ['GUEST'], null), // Sommerturnier (finished)
      seedMember('gast-fruehling', 'Frieda', 'Frühling', ['GUEST'], null), // Frühlingscup (groups done, no knockout yet)
    ];
  }

  constructor() {
    this.addMissingMembers();
    this.upgradeSeed();
  }

  /** Version 1 = mock data stored before the seed was versioned; a fresh seed runs the (harmless) upgrade once too. */
  readonly #seed = new MockTable<{ version: number }>('seed-version', () => ({ version: 1 }));

  /**
   * Browsers that stored mock data from an older seed get the membership of the seeded people, the seeded offices and
   * team places, and the BOARD role that comes with an office; their own changes otherwise stay.
   */
  private upgradeSeed(): void {
    if (this.#seed.data.version >= SEED_VERSION) return;
    for (const seeded of MockDirectory.seedMembers()) {
      const stored = this.members.data.find((m) => m.id === seeded.id);
      if (stored && stored.roles.length) Object.assign(stored, { membershipType: seeded.membershipType, honorary: seeded.honorary, memberSince: seeded.memberSince });
    }
    for (const office of MockDirectory.seedOffices()) {
      const taken = SINGLE_OFFICES.includes(office.office) && this.running().some((o) => o.office === office.office);
      if (!this.offices.data.some((o) => o.id === office.id) && !this.officesOf(office.memberId).includes(office.office) && !taken) this.offices.data.push(office);
    }
    for (const [memberId, teams] of Object.entries(MockDirectory.seedMemberships())) this.memberships.data[memberId] ??= teams;
    for (const member of this.members.data) this.syncBoardRole(member);
    this.members.save();
    this.offices.save();
    this.memberships.save();
    this.#seed.data.version = SEED_VERSION;
    this.#seed.save();
  }

  /** Members added to the seed later reach browsers that already stored the mock data. */
  private addMissingMembers(): void {
    const missing = MockDirectory.seedMembers().filter((m) => !this.members.data.some((x) => x.id === m.id));
    if (!missing.length) return;
    this.members.data.push(...missing);
    this.members.save();
  }

  /** memberId → teamId → role in that team */
  readonly memberships = new MockTable<Record<string, Record<string, TeamRole>>>('memberships', () => MockDirectory.seedMemberships());

  private static seedMemberships(): Record<string, Record<string, TeamRole>> {
    return {
      trainer: { 't-damen': 'COACH', 't-u16': 'COACH' },
      spieler: { 't-u16': 'PLAYER' },
      spielerin: { 't-damen': 'PLAYER' },
      neu: { 't-damen': 'PLAYER' },
      kassier: { 't-damen': 'PLAYER' },
      mia: { 't-damen': 'PLAYER' },
      noah: { 't-damen': 'PLAYER' },
      leon: { 't-damen': 'PLAYER' },
      sara: { 't-u16': 'PLAYER' },
    };
  }

  /** A complete board of five (odd, §9 Abs 1): Karin is deputy and treasurer (§9 Abs 4); Anna and Peter check the books. */
  readonly offices = new MockTable<OfficeRow[]>('offices', () => MockDirectory.seedOffices());

  private static seedOffices(): OfficeRow[] {
    return [
      seedOffice('o-chair', 'vorstand', 'CHAIR'),
      seedOffice('o-vice', 'kassier', 'VICE_CHAIR'),
      seedOffice('o-treasurer', 'kassier', 'TREASURER'),
      seedOffice('o-secretary', 'schrift', 'SECRETARY'),
      seedOffice('o-member', 'beisitz', 'BOARD_MEMBER'),
      seedOffice('o-member2', 'beisitz2', 'BOARD_MEMBER'),
      seedOffice('o-auditor', 'admin', 'AUDITOR'),
      seedOffice('o-auditor2', 'pruefer', 'AUDITOR'),
    ];
  }

  /** guardianId → minor ids */
  readonly wards = new MockTable<Record<string, string[]>>('wards', () => ({ eltern: ['spieler'] }));

  readonly security = new MockTable<Record<string, PinState>>('security', () => ({}));

  /** server: members_club_pin (one row; null until admin or board set it) */
  readonly clubPin = new MockTable<{ pin: string | null; changedAt: string | null }>('club-pin', () => ({
    pin: MockDirectory.PIN,
    changedAt: new Date().toISOString(),
  }));

  accounts(): DevAccount[] {
    return this.members.data.map((m) => ({ email: m.email, name: `${m.firstName} ${m.lastName}`, roles: m.roles }));
  }

  findActive(email: string | null): Member | null {
    return this.members.data.find((m) => m.email === email && m.active) ?? null;
  }

  /** Server audience of team items: team members, their guardians, admin and board. */
  teamAudience(teamId: string | null): MockAudience {
    if (!teamId) return { everyone: true };
    const members = this.teamMembers(teamId);
    const guardians = Object.entries(this.wards.data)
      .filter(([, minors]) => minors.some((m) => members.includes(m)))
      .map(([guardian]) => guardian);
    return { members: [...members, ...guardians], roles: ADMIN_BOARD };
  }

  /** Club members; tournament guests are not part of "everyone". */
  activeIds(): string[] {
    return this.members.data.filter((m) => m.active && !guestOnly(m.roles)).map((m) => m.id);
  }

  /** Active members an audience reaches (server: MembersApi.AUDIENCE_IDS). */
  audienceIds(audience: MockAudience): string[] {
    return this.members.data
      .filter((m) => m.active && MockEventBus.includes(audience, m.id, m.roles))
      .map((m) => m.id);
  }

  guardiansOf(memberIds: readonly string[]): string[] {
    return Object.entries(this.wards.data)
      .filter(([, minors]) => minors.some((m) => memberIds.includes(m)))
      .map(([guardian]) => guardian);
  }

  /** The signed-in member, like the server's ResolveActor; refuses until the profile is complete. */
  actor(request: MockRequest, allowIncompleteProfile = false): Member {
    const member = this.findActive(request.email);
    if (!member) return fail(request.email ? 403 : 401, 'auth.unknown-member');
    if (guestOnly(member.roles) && !MockDirectory.allowsGuest(request)) fail(403, 'access.denied');
    if (!allowIncompleteProfile && this.missing(member).length) fail(403, 'profile.birth-date-required');
    return member;
  }

  hasRole(member: Member, roles: readonly Role[]): boolean {
    return member.roles.some((r) => roles.includes(r));
  }

  isPrivileged(member: Member): boolean {
    return this.hasRole(member, PRIVILEGED);
  }

  isManager(member: Member): boolean {
    return this.hasRole(member, ADMIN_BOARD);
  }

  /** Server: actor.requireRole(roles) = one of the roles, no step-up (restricted reads). */
  requireRole(member: Member, roles: readonly Role[] = PRIVILEGED): void {
    if (!this.hasRole(member, roles)) fail(403, 'access.denied');
  }

  /** Server: actor.requirePrivileged(roles) = one of the roles + a step-up within the last minutes. */
  requirePrivileged(member: Member, roles: readonly Role[] = PRIVILEGED): void {
    if (!this.hasRole(member, roles)) fail(403, 'access.denied');
    const until = this.pinState(member).stepUpUntil;
    if (!until || new Date(until) <= new Date()) fail(403, 'auth.step-up-required');
  }

  teamRoles(memberId: string): Record<string, TeamRole> {
    return this.memberships.data[memberId] ?? {};
  }

  teamMembers(teamId: string): string[] {
    return Object.entries(this.memberships.data)
      .filter(([, teams]) => teamId in teams)
      .map(([memberId]) => memberId);
  }

  wardsOf(memberId: string): string[] {
    return this.wards.data[memberId] ?? [];
  }

  /** Teams whose items the member sees: own teams plus the teams of their minors. */
  visibleTeamIds(memberId: string): Set<string> {
    const ids = new Set(Object.keys(this.teamRoles(memberId)));
    for (const ward of this.wardsOf(memberId)) Object.keys(this.teamRoles(ward)).forEach((id) => ids.add(id));
    return ids;
  }

  /** server: TeamHandlers.roster (team members and admin/board, others 404) */
  roster(viewer: Member, teamId: string): Roster {
    const team = this.teams.data.find((t) => t.id === teamId);
    if (!team || (!this.isManager(viewer) && !(teamId in this.teamRoles(viewer.id)))) return fail(404, 'team.not-found');
    const entries = this.teamMembers(teamId)
      .flatMap((memberId) => {
        const name = this.name(memberId);
        return name ? [{ memberId, name, teamRole: this.teamRoles(memberId)[teamId] }] : [];
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    return { team, entries };
  }

  /** server: MemberHandlers.list (admin/board with step-up; birth dates for admins only) */
  list(viewer: Member): MemberList {
    this.requirePrivileged(viewer, ADMIN_BOARD);
    const items = [...this.members.data]
      .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName))
      .map((m) => (this.hasRole(viewer, ['ADMIN']) || m.id === viewer.id ? m : { ...m, birthDate: null }));
    return { items };
  }

  hasPhotoConsent(memberId: string): boolean {
    return this.members.data.some((m) => m.id === memberId && m.active && m.photoConsent);
  }

  name(memberId: string): string | null {
    const m = this.members.data.find((x) => x.id === memberId && x.active);
    return m ? `${m.firstName} ${m.lastName}` : null;
  }

  /** server: ActorArgumentResolver.allowsGuest - deny by default. */
  static allowsGuest(request: MockRequest): boolean {
    const path = request.path ?? '';
    return (request.method === 'GET' && (path === '/api/v1/me' || path === '/api/v1/tournaments' || path.startsWith('/api/v1/tournaments/')))
      || path.startsWith('/api/v1/me/notifications') || path.startsWith('/api/v1/me/notification-preferences');
  }

  missing(member: Member): MissingProfileField[] {
    const gaps: MissingProfileField[] = [];
    if (guestOnly(member.roles)) return gaps; // guests only read their tournament
    if (!member.birthDate) gaps.push('birthDate');
    return gaps;
  }

  securityStatus(member: Member): SecurityStatus {
    const state = this.pinState(member);
    const active = state.stepUpUntil && new Date(state.stepUpUntil) > new Date() ? state.stepUpUntil : null;
    return {
      clubPinSet: !!this.clubPin.data.pin,
      clubPinChangedAt: this.clubPin.data.changedAt,
      pinLocked: state.attempts >= settings.security.maxPinAttempts,
      stepUpUntil: active,
      devices: [],
    };
  }

  /** server: SecurityHandlers SET_CLUB_PIN - admin/board; the first PIN needs no step-up (there is none to confirm with). */
  setClubPin(member: Member, newPin: unknown): void {
    if (this.clubPin.data.pin) this.requirePrivileged(member, ADMIN_BOARD);
    else this.requireRole(member, ADMIN_BOARD);
    this.clubPin.data.pin = MockDirectory.validPin(newPin);
    this.clubPin.data.changedAt = new Date().toISOString();
    this.clubPin.save();
    for (const other of this.members.data) {
      if (other.active && other.id !== member.id && this.isPrivileged(other)) this.securityChanged(other, 'CLUB_PIN_CHANGED');
    }
  }

  // --- members admin (server: MemberHandlers, SecurityHandlers) ---

  /** Self, admin/board, guardian or a coach of one of the member's teams; others 404. */
  get(viewer: Member, memberId: string): Member {
    const target = this.members.data.find((m) => m.id === memberId);
    const allowed = viewer.id === memberId || this.isManager(viewer) || this.wardsOf(viewer.id).includes(memberId) || this.isCoachOf(viewer.id, memberId);
    if (!target || !allowed) return fail(404, 'member.not-found');
    return this.visibleTo(viewer, target);
  }

  invite(viewer: Member, body: Record<string, any>): Member {
    this.requirePrivileged(viewer, ADMIN_BOARD);
    const roles = MockDirectory.roles(body.roles);
    if (roles.includes('ADMIN') && !this.hasRole(viewer, ['ADMIN'])) fail(403, 'access.denied');
    if (roles.includes('BOARD')) fail(409, 'member.board-by-office');
    const email = MockDirectory.email(body.email);
    if (this.members.data.some((m) => m.email === email)) fail(409, 'member.email-taken');
    const member: Member = {
      id: crypto.randomUUID(),
      email,
      firstName: MockDirectory.name(body.firstName, 'member.first-name-invalid'),
      lastName: MockDirectory.name(body.lastName, 'member.last-name-invalid'),
      birthDate: null,
      phone: null,
      photoConsent: false,
      active: true,
      roles,
      membershipType: MockDirectory.membershipType(body.membershipType),
      honorary: false,
      memberSince: body.membershipType ? this.clock.today() : null,
    };
    this.applyProfile(member, { birthDate: body.birthDate || undefined, phone: body.phone ?? undefined, photoConsent: body.photoConsent });
    if (body.guardianId != null && !this.members.data.some((m) => m.id === body.guardianId && m.active)) fail(404, 'member.not-found');
    this.members.data.push(member);
    this.members.save();
    if (body.guardianId != null) this.linkGuardian(viewer, member.id, body.guardianId);
    mockServer.events.publish({ type: 'members.member-invited', data: { memberId: member.id }, audience: { roles: ADMIN_BOARD } });
    return member;
  }

  setRoles(viewer: Member, memberId: string, rawRoles: unknown): Member {
    this.requirePrivileged(viewer, ['ADMIN']);
    const roles = MockDirectory.roles(rawRoles);
    if (viewer.id === memberId && !roles.includes('ADMIN')) fail(409, 'member.cannot-remove-own-admin');
    const target = this.members.data.find((m) => m.id === memberId) ?? fail(404, 'member.not-found');
    if (target.roles.includes('BOARD') !== roles.includes('BOARD')) fail(409, 'member.board-by-office');
    target.roles = roles;
    this.members.save();
    return this.visibleTo(viewer, target);
  }

  deactivate(viewer: Member, memberId: string): Member {
    this.requirePrivileged(viewer, ADMIN_BOARD);
    if (viewer.id === memberId) fail(409, 'member.cannot-deactivate-self');
    const target = this.members.data.find((m) => m.id === memberId) ?? fail(404, 'member.not-found');
    if (target.roles.includes('ADMIN') && !this.hasRole(viewer, ['ADMIN'])) fail(403, 'access.denied');
    target.active = false;
    // server: MembershipHandlers.endOfficesOf
    for (const o of this.running().filter((o) => o.memberId === memberId)) o.endedOn = this.clock.today();
    this.offices.save();
    target.roles = target.roles.filter((r) => r !== 'BOARD');
    this.members.save();
    mockServer.events.publish({ type: 'members.member-deactivated', data: { memberId }, audience: { roles: ADMIN_BOARD } });
    // server: TeamHandlers.onMemberDeactivated
    for (const teamId of Object.keys(this.teamRoles(memberId))) this.removeFromTeamUnchecked(teamId, memberId);
    return this.visibleTo(viewer, target);
  }

  /** server: MemberHandlers.reactivate */
  reactivate(viewer: Member, memberId: string): Member {
    this.requirePrivileged(viewer, ADMIN_BOARD);
    const target = this.members.data.find((m) => m.id === memberId) ?? fail(404, 'member.not-found');
    if (!target.active && target.roles.length === 0) fail(409, 'member.erased');
    if (target.roles.includes('ADMIN') && !this.hasRole(viewer, ['ADMIN'])) fail(403, 'access.denied');
    target.active = true;
    this.members.save();
    return this.visibleTo(viewer, target);
  }

  /** server: MemberHandlers.erase; the record stays, every personal value goes. */
  erase(viewer: Member, memberId: string): void {
    this.requirePrivileged(viewer, ['ADMIN']);
    const target = this.members.data.find((m) => m.id === memberId) ?? fail(404, 'member.not-found');
    if (target.active) fail(409, 'member.erase-active');
    Object.assign(target, { email: `geloescht-${target.id}@example.invalid`, firstName: 'Gelöschtes', lastName: 'Mitglied', birthDate: null, phone: null,
      photoConsent: false, roles: [], membershipType: null, honorary: false, memberSince: null });
    delete this.wards.data[memberId];
    for (const wards of Object.values(this.wards.data)) wards.splice(0, wards.length, ...wards.filter((id) => id !== memberId));
    this.members.save();
    this.wards.save();
  }

  // --- membership and offices (server: MembershipHandlers) ---

  setMembership(viewer: Member, memberId: string, body: Record<string, any>): Member {
    this.requirePrivileged(viewer, ADMIN_BOARD);
    const target = this.members.data.find((m) => m.id === memberId && m.active) ?? fail(404, 'member.not-found');
    const membershipType = MockDirectory.membershipType(body.membershipType);
    const honorary = body.honorary === true;
    const memberSince = membershipType || honorary ? (typeof body.memberSince === 'string' && body.memberSince ? body.memberSince : null) : null;
    if (memberSince && memberSince > this.clock.today()) fail(400, 'member.member-since-in-future');
    if (!canVote({ ...target, membershipType, honorary }) && this.running().some((o) => o.memberId === memberId)) fail(409, 'member.holds-office');
    Object.assign(target, { membershipType, honorary, memberSince });
    this.members.save();
    return this.visibleTo(viewer, target);
  }

  board(): { offices: (OfficeRow & { name: string })[]; warnings: string[] } {
    const running = this.running();
    const people = new Set(running.filter((o) => o.office !== 'AUDITOR').map((o) => o.memberId));
    const warnings: string[] = [];
    if (people.size < 3) warnings.push('board.too-small');
    else if (people.size % 2 === 0) warnings.push('board.even');
    for (const kind of ['CHAIR', 'TREASURER', 'SECRETARY']) {
      if (!running.some((o) => o.office === kind)) warnings.push(`board.${kind.toLowerCase()}-missing`);
    }
    if (running.filter((o) => o.office === 'AUDITOR').length < 2) warnings.push('board.auditors-missing');
    const offices = running
      .map((o) => ({ ...o, name: this.displayName(o.memberId) }))
      .sort((a, b) => OFFICES.indexOf(a.office) - OFFICES.indexOf(b.office) || a.startsOn.localeCompare(b.startsOn));
    return { offices, warnings };
  }

  assignOffice(viewer: Member, body: Record<string, any>): OfficeRow & { name: string } {
    this.requirePrivileged(viewer, ADMIN_BOARD);
    const office = body.office as OfficeRow['office'];
    if (!OFFICES.includes(office) || typeof body.startsOn !== 'string') return fail(400, 'request.invalid');
    if (body.startsOn > this.clock.today()) fail(400, 'office.start-in-future');
    const termEndsOn = typeof body.termEndsOn === 'string' && body.termEndsOn ? body.termEndsOn : plusYears(body.startsOn, 3);
    if (termEndsOn <= body.startsOn || termEndsOn > plusYears(body.startsOn, 3)) fail(400, 'office.term-invalid');
    const holder = this.members.data.find((m) => m.id === body.memberId && m.active) ?? fail(404, 'member.not-found');
    if (!canVote(holder)) fail(409, 'office.not-eligible');
    const running = this.running();
    if (SINGLE_OFFICES.includes(office) && running.some((o) => o.office === office)) fail(409, 'office.taken');
    if (office === 'AUDITOR' && running.filter((o) => o.office === 'AUDITOR').length >= 2) fail(409, 'office.taken');
    const held = running.filter((o) => o.memberId === holder.id).map((o) => o.office);
    if (held.includes(office)) fail(409, 'office.already-held');
    if (held.length && (held.includes('AUDITOR') || office === 'AUDITOR')) fail(409, 'office.auditor-in-board');
    const both = [...held, office];
    if (held.length && !(both.length === 2 && both.includes('VICE_CHAIR') && (both.includes('TREASURER') || both.includes('SECRETARY')))) {
      fail(409, 'office.combination');
    }
    const row: OfficeRow = { id: crypto.randomUUID(), memberId: holder.id, office, startsOn: body.startsOn, termEndsOn, endedOn: null, coopted: body.coopted === true };
    this.offices.data.push(row);
    this.offices.save();
    this.syncBoardRole(holder);
    return { ...row, name: this.displayName(holder.id) };
  }

  endOffice(viewer: Member, officeId: string): OfficeRow & { name: string } {
    this.requirePrivileged(viewer, ADMIN_BOARD);
    const row = this.offices.data.find((o) => o.id === officeId) ?? fail(404, 'office.not-found');
    if (row.endedOn) fail(409, 'office.already-ended');
    row.endedOn = this.clock.today();
    this.offices.save();
    const holder = this.members.data.find((m) => m.id === row.memberId);
    if (holder) this.syncBoardRole(holder);
    return { ...row, name: this.displayName(row.memberId) };
  }

  /** server: MembersApi.ELECTORATE — voters of a general meeting, the board, or every club member. */
  electorate(body: 'ASSEMBLY' | 'BOARD' | 'CLUB'): string[] {
    if (body === 'BOARD') {
      const board = new Set(this.running().filter((o) => o.office !== 'AUDITOR').map((o) => o.memberId));
      return this.members.data.filter((m) => m.active && board.has(m.id)).map((m) => m.id);
    }
    return this.members.data.filter((m) => (body === 'ASSEMBLY' ? canVote(m) : m.active && (!!m.membershipType || m.honorary))).map((m) => m.id);
  }

  officesOf(memberId: string): OfficeRow['office'][] {
    return this.running().filter((o) => o.memberId === memberId).map((o) => o.office);
  }

  private running(): OfficeRow[] {
    return this.offices.data.filter((o) => !o.endedOn);
  }

  /** A running board office is the only way to BOARD; a change closes the live sessions like on the server. */
  private syncBoardRole(member: Member): void {
    const board = member.active && this.running().some((o) => o.memberId === member.id && o.office !== 'AUDITOR');
    if (board === member.roles.includes('BOARD')) return;
    member.roles = board ? [...member.roles, 'BOARD'] : member.roles.filter((r) => r !== 'BOARD');
    this.members.save();
  }

  private displayName(memberId: string): string {
    const m = this.members.data.find((x) => x.id === memberId);
    return m ? `${m.firstName} ${m.lastName}` : '–';
  }

  private static membershipType(value: unknown): MembershipType | null {
    if (value == null) return null;
    return value === 'ORDINARY' || value === 'EXTRAORDINARY' ? value : fail(400, 'request.invalid');
  }

  /** server: MemberHandlers.listGuardians (admin/board) */
  listGuardians(viewer: Member, minorId: string): { items: { memberId: string; name: string }[] } {
    if (!this.hasRole(viewer, ADMIN_BOARD)) fail(403, 'access.denied');
    return {
      items: this.members.data
        .filter((m) => m.active && this.wards.data[m.id]?.includes(minorId))
        .map((m) => ({ memberId: m.id, name: `${m.firstName} ${m.lastName}` })),
    };
  }

  unlinkGuardian(viewer: Member, minorId: string, guardianId: string): Member {
    this.requirePrivileged(viewer, ADMIN_BOARD);
    const minor = this.members.data.find((m) => m.id === minorId) ?? fail(404, 'member.not-found');
    const wards = this.wards.data[guardianId] ?? [];
    if (!wards.includes(minorId)) fail(404, 'member.guardian-not-linked');
    this.wards.data[guardianId] = wards.filter((id) => id !== minorId);
    this.wards.save();
    return this.visibleTo(viewer, minor);
  }

  /** server: MemberHandlers.wouldCycle */
  private wouldCycle(guardianId: string, minorId: string): boolean {
    const open = [...(this.wards.data[minorId] ?? [])];
    const seen = new Set<string>();
    while (open.length) {
      const ward = open.pop()!;
      if (ward === guardianId) return true;
      if (!seen.has(ward)) {
        seen.add(ward);
        open.push(...(this.wards.data[ward] ?? []));
      }
    }
    return false;
  }

  linkGuardian(viewer: Member, minorId: string, guardianId: unknown): Member {
    this.requirePrivileged(viewer, ADMIN_BOARD);
    if (typeof guardianId !== 'string') return fail(400, 'request.invalid');
    if (guardianId === minorId) fail(400, 'member.guardian-is-self');
    if (!this.members.data.some((m) => m.id === guardianId && m.active)) fail(404, 'member.not-found');
    const minor = this.members.data.find((m) => m.id === minorId) ?? fail(404, 'member.not-found');
    if (this.wouldCycle(guardianId, minorId)) fail(409, 'member.guardian-cycle');
    const wards = (this.wards.data[guardianId] ??= []);
    if (!wards.includes(minorId)) wards.push(minorId);
    this.wards.save();
    return this.visibleTo(viewer, minor);
  }

  resetSecurity(viewer: Member, memberId: string): void {
    this.requirePrivileged(viewer, ['ADMIN']);
    const target = this.members.data.find((m) => m.id === memberId) ?? fail(404, 'member.not-found');
    this.security.data[target.id] = { attempts: 0, stepUpUntil: null };
    this.security.save();
    this.securityChanged(target, 'RESET_BY_ADMIN');
  }

  // --- teams admin (server: TeamHandlers) ---

  createTeam(viewer: Member, body: Record<string, unknown>): Team {
    this.requirePrivileged(viewer, ADMIN_BOARD);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > settings.teams.nameMaxLength) fail(400, 'team.name-invalid');
    if (typeof body.season !== 'string' || !new RegExp(settings.teams.seasonPattern).test(body.season)) fail(400, 'team.season-invalid');
    if (this.teams.data.some((t) => t.name === name && t.season === body.season)) fail(409, 'team.exists');
    const team: Team = { id: crypto.randomUUID(), name, season: body.season as string };
    this.teams.data.push(team);
    this.teams.save();
    return team;
  }

  /** server: TeamHandlers.update; name and season, unique per season. */
  updateTeam(viewer: Member, teamId: string, body: Record<string, unknown>): Team {
    this.requirePrivileged(viewer, ADMIN_BOARD);
    const team = this.teams.data.find((t) => t.id === teamId) ?? fail(404, 'team.not-found');
    const name = typeof body.name === 'string' ? body.name.trim() : team.name;
    const season = typeof body.season === 'string' ? body.season : team.season;
    if (!name || name.length > settings.teams.nameMaxLength) fail(400, 'team.name-invalid');
    if (!new RegExp(settings.teams.seasonPattern).test(season)) fail(400, 'team.season-invalid');
    if (this.teams.data.some((t) => t.id !== teamId && t.name.toLowerCase() === name.toLowerCase() && t.season === season)) fail(409, 'team.exists');
    Object.assign(team, { name, season });
    this.teams.save();
    return team;
  }

  /** server: TeamHandlers.delete; `inUse` stands in for the foreign keys of appointments, tasks and folders. */
  deleteTeam(viewer: Member, teamId: string, inUse: boolean): void {
    this.requirePrivileged(viewer, ADMIN_BOARD);
    const index = this.teams.data.findIndex((t) => t.id === teamId);
    if (index < 0) fail(404, 'team.not-found');
    if (inUse) fail(409, 'team.in-use');
    this.teams.data.splice(index, 1);
    for (const roles of Object.values(this.memberships.data)) delete roles[teamId];
    this.teams.save();
    this.memberships.save();
  }

  /** Admin/board only; a coach of the team gets 403, everyone else 404. Also changes the role of existing members. */
  setTeamMember(viewer: Member, teamId: string, memberId: string, teamRole: unknown): Roster {
    if (!this.teams.data.some((t) => t.id === teamId)) fail(404, 'team.not-found');
    // Not coaches: membership would let them read any member's birth date and contact data.
    if (!this.isManager(viewer)) {
      if (this.teamRoles(viewer.id)[teamId] === 'COACH') fail(403, 'access.denied');
      fail(404, 'team.not-found');
    }
    this.requirePrivileged(viewer, ADMIN_BOARD);
    if (teamRole !== 'COACH' && teamRole !== 'PLAYER') fail(400, 'request.invalid');
    if (!this.name(memberId)) fail(404, 'member.not-found');
    (this.memberships.data[memberId] ??= {})[teamId] = teamRole as TeamRole;
    this.memberships.save();
    this.membershipChanged(teamId, memberId);
    return this.roster(viewer, teamId);
  }

  /** Admin/board remove anyone; a coach of the team removes players only. */
  removeTeamMember(viewer: Member, teamId: string, memberId: string): Roster {
    if (!this.teams.data.some((t) => t.id === teamId)) fail(404, 'team.not-found');
    if (this.isManager(viewer)) {
      this.requirePrivileged(viewer, ADMIN_BOARD);
    } else {
      if (this.teamRoles(viewer.id)[teamId] !== 'COACH') fail(404, 'team.not-found');
      this.requirePrivileged(viewer, ['COACH']);
      if ((this.teamRoles(memberId)[teamId] ?? 'PLAYER') !== 'PLAYER') fail(403, 'access.denied');
    }
    this.removeFromTeamUnchecked(teamId, memberId);
    return this.roster(viewer, teamId);
  }

  isCoachOf(coachId: string, memberId: string): boolean {
    const coach = this.teamRoles(coachId);
    return Object.keys(this.teamRoles(memberId)).some((teamId) => coach[teamId] === 'COACH');
  }

  /** Birth date only for self, admins, guardians and coaches of the member's teams. */
  private visibleTo(viewer: Member, member: Member): Member {
    const sees = viewer.id === member.id || this.hasRole(viewer, ['ADMIN']) || this.wardsOf(viewer.id).includes(member.id) || this.isCoachOf(viewer.id, member.id);
    return sees ? member : { ...member, birthDate: null };
  }

  private removeFromTeamUnchecked(teamId: string, memberId: string): void {
    const teams = this.memberships.data[memberId];
    if (!teams || !(teamId in teams)) return;
    delete teams[teamId];
    this.memberships.save();
    this.membershipChanged(teamId, memberId);
  }

  /** server: TeamsApi.MembershipChanged — the team, the member, admin and board */
  private membershipChanged(teamId: string, memberId: string): void {
    mockServer.events.publish({
      type: 'teams.membership-changed',
      data: { teamId, memberId },
      audience: { members: [...this.teamMembers(teamId), memberId], roles: ADMIN_BOARD },
    });
  }

  private static name(value: unknown, code: string): string {
    const name = typeof value === 'string' ? value.trim() : '';
    if (!name || name.length > settings.members.nameMaxLength) return fail(400, code);
    return name;
  }

  private static roles(value: unknown): Role[] {
    const all: readonly Role[] = ['ADMIN', 'BOARD', 'COACH', 'PLAYER', 'PARENT', 'VOLUNTEER', 'GUEST'];
    if (!Array.isArray(value) || value.some((r) => !all.includes(r))) return fail(400, 'request.invalid');
    return [...new Set(value as Role[])];
  }

  /** server: MembersApi.SecurityChanged (internal; the notifications mock turns it into a message) */
  private securityChanged(member: Member, change: 'CLUB_PIN_CHANGED' | 'PIN_LOCKED' | 'RESET_BY_ADMIN'): void {
    mockServer.events.publish({ type: 'members.security-changed', data: { memberId: member.id, change } });
  }

  stepUp(member: Member, pin: unknown): StepUp {
    this.verifyPin(member, pin);
    return this.grantStepUp(member);
  }

  /** server: MemberHandlers.updateProfile — self or guardian freely, admin/board with step-up, others 404 */
  updateProfile(viewer: Member, memberId: string, patch: Record<string, unknown>): Member {
    const target = this.members.data.find((m) => m.id === memberId);
    const own = viewer.id === memberId || this.wardsOf(viewer.id).includes(memberId);
    if (!own) {
      if (!this.isManager(viewer)) return fail(404, 'member.not-found');
      this.requirePrivileged(viewer, ADMIN_BOARD);
    }
    if (!target) return fail(404, 'member.not-found');
    this.applyProfile(target, patch);
    return this.visibleTo(viewer, target);
  }

  /** server: Member.normalizeEmail */
  static email(raw: unknown): string {
    const email = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    if (!/^[\x21-\x3f\x41-\x7e]+@[^@\s]+\.[^@\s]+$/.test(email) || email.includes('ß')) fail(400, 'member.email-invalid');
    return email;
  }

  /** server: MemberHandlers.changeEmail / ChangeRequestHandlers.moveLogin */
  changeEmail(viewer: Member, memberId: string, raw: unknown): Member {
    this.requirePrivileged(viewer, ADMIN_BOARD);
    const target = this.members.data.find((m) => m.id === memberId) ?? fail(404, 'member.not-found');
    this.moveLogin(target, raw);
    return this.visibleTo(viewer, target);
  }

  /** Sets a new e-mail after the same checks as on invitation. */
  moveLogin(member: Member, raw: unknown): void {
    const email = MockDirectory.email(raw);
    if (email === member.email) return;
    if (this.members.data.some((m) => m.email === email)) fail(409, 'member.email-taken');
    member.email = email;
    this.members.save();
  }

  /** Validates a profile change on a copy; the member stays unchanged. */
  applyProfileCopy(member: Member, patch: Record<string, unknown>): Member {
    return this.applyProfile({ ...member }, patch);
  }

  applyProfile(member: Member, patch: Record<string, unknown>): Member {
    const { firstName, lastName, birthDate, phone, photoConsent } = patch;
    if (birthDate !== undefined) {
      if (typeof birthDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || isNaN(Date.parse(birthDate))) {
        return fail(400, 'member.birth-date-invalid');
      }
      if (new Date(birthDate) >= new Date()) fail(400, 'member.birth-date-in-future');
      if (birthDate < settings.members.earliestBirthDate) fail(400, 'member.birth-date-invalid');
      member.birthDate = birthDate;
    }
    if (phone !== undefined && phone !== null && phone !== '') {
      if (typeof phone !== 'string' || !/^\+?[0-9 /-]+$/.test(phone) || phone.length > settings.profile.phoneMaxLength) {
        return fail(400, 'member.phone-invalid');
      }
      member.phone = phone;
    } else if (phone === '') {
      member.phone = null; // server: '' clears, null leaves the number unchanged
    }
    if (firstName !== undefined) member.firstName = MockDirectory.name(firstName, 'member.first-name-invalid');
    if (lastName !== undefined) member.lastName = MockDirectory.name(lastName, 'member.last-name-invalid');
    if (typeof photoConsent === 'boolean') member.photoConsent = photoConsent;
    this.members.save();
    return member;
  }

  private pinState(member: Member): PinState {
    return (this.security.data[member.id] ??= { attempts: 0, stepUpUntil: null });
  }

  private verifyPin(member: Member, pin: unknown): void {
    const state = this.pinState(member);
    const max = settings.security.maxPinAttempts;
    if (!this.clubPin.data.pin) fail(409, 'auth.club-pin-not-set');
    if (state.attempts >= max) fail(403, 'auth.pin-locked');
    if (pin !== this.clubPin.data.pin) {
      state.attempts++;
      this.security.save();
      if (state.attempts === max) this.securityChanged(member, 'PIN_LOCKED');
      fail(403, state.attempts >= max ? 'auth.pin-locked' : 'auth.pin-wrong');
    }
    state.attempts = 0;
  }

  private grantStepUp(member: Member): StepUp {
    const until = new Date(Date.now() + settings.security.stepUpMinutes * 60_000).toISOString();
    this.pinState(member).stepUpUntil = until;
    this.security.save();
    return { until };
  }

  /** server: PinHasher.requireValid */
  private static validPin(pin: unknown): string {
    const length = settings.security.pinLength;
    if (typeof pin !== 'string' || !new RegExp(`^[0-9A-Za-z]{${length}}$`).test(pin)) return fail(400, 'auth.pin-format');
    const lower = pin.toLowerCase();
    const sequence = '0123456789abcdefghijklmnopqrstuvwxyz';
    const reversed = [...lower].reverse().join('');
    if (new Set(lower).size === 1 || sequence.includes(lower) || sequence.includes(reversed)) fail(400, 'auth.pin-too-simple');
    return pin;
  }
}

export const directory = new MockDirectory();

mockServer
  .on('GET', '/api/v1/club', () => directory.club)
  .on('GET', '/api/v1/me', (req) => {
    const member = directory.actor(req, true);
    const own = directory.teamRoles(member.id);
    return { member, teams: directory.teams.data.filter((t) => t.id in own), missing: directory.missing(member), wardIds: directory.wardsOf(member.id),
      wardNames: Object.fromEntries(directory.wardsOf(member.id).map((id) => [id, directory.name(id) ?? ''])) };
  })
  // Own profile also works before onboarding is complete (birth date step).
  .on('PATCH', '/api/v1/members/:id', (req) => {
    const viewer = directory.actor(req, req.params.id === directory.findActive(req.email)?.id);
    return directory.updateProfile(viewer, req.params.id, req.body ?? {});
  })
  .on('GET', '/api/v1/me/security', (req) => directory.securityStatus(directory.actor(req, true)))
  .on('PUT', '/api/v1/club/pin', (req) => directory.setClubPin(directory.actor(req), req.body?.pin))
  .on('POST', '/api/v1/me/step-up', (req) => directory.stepUp(directory.actor(req), req.body?.pin))
  .on('GET', '/api/v1/teams', (req) => {
    const member = directory.actor(req);
    const own = directory.teamRoles(member.id);
    const mine = req.query.get('mine') === 'true';
    return { items: directory.teams.data.filter((t) => !mine || t.id in own) };
  })
  .on('GET', '/api/v1/teams/:id/roster', (req) => directory.roster(directory.actor(req), req.params.id))
  .on('GET', '/api/v1/members', (req) => directory.list(directory.actor(req)));
