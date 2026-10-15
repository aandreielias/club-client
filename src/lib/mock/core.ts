// Mock of the club-server core: club facts, members, teams, wards, PIN and step-up.
// Rules mirror the server's members and teams modules closely enough to exercise every client flow.
import { settings } from '../../settings';
import { ZonedClock } from '../time/ZonedClock';
import {
  MANAGERS,
  PRIVILEGED,
  type Club,
  type Member,
  type MemberList,
  type MissingProfileField,
  type Role,
  type Roster,
  type SecurityStatus,
  type StepUp,
  type Team,
  type TeamRole,
} from '../types';
import type { MockAudience } from './MockEventBus';
import { MockServer, mockServer, type MockRequest } from './MockServer';
import { MockTable } from './MockTable';

interface PinState {
  pin: string | null;
  attempts: number;
  stepUpUntil: string | null;
}

export interface DevAccount {
  email: string;
  name: string;
  roles: Role[];
}

const fail = MockServer.fail;

function seedMember(id: string, firstName: string, lastName: string, roles: Role[], birthDate: string | null): Member {
  return { id, email: `${id}@example.at`, firstName, lastName, birthDate, phone: null, photoConsent: true, active: true, roles };
}

/** Members, teams and security state of the mock club, plus the server's authorization helpers. */
export class MockDirectory {
  /** PIN of every seeded privileged member; shown on the dev login page. */
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

  readonly members = new MockTable<Member[]>('members', () => [
    seedMember('admin', 'Anna', 'Admin', ['ADMIN'], '1985-03-12'),
    seedMember('vorstand', 'Bernd', 'Vorstand', ['BOARD'], '1978-11-02'),
    seedMember('trainer', 'Clara', 'Trainer', ['COACH', 'PLAYER'], '1992-06-30'),
    // Minor without photo consent: photos tagged with him are hidden from everyone but managers.
    { ...seedMember('spieler', 'David', 'Spieler', ['PLAYER'], '2010-01-20'), photoConsent: false },
    seedMember('spielerin', 'Lena', 'Spielerin', ['PLAYER'], '1998-08-08'),
    seedMember('eltern', 'Eva', 'Eltern', ['PARENT'], '1980-09-14'),
    seedMember('neu', 'Felix', 'Neu', ['PLAYER'], null),
  ]);

  /** memberId → teamId → role in that team */
  readonly memberships = new MockTable<Record<string, Record<string, TeamRole>>>('memberships', () => ({
    trainer: { 't-damen': 'COACH', 't-u16': 'COACH' },
    spieler: { 't-u16': 'PLAYER' },
    spielerin: { 't-damen': 'PLAYER' },
    neu: { 't-damen': 'PLAYER' },
  }));

  /** guardianId → minor ids */
  readonly wards = new MockTable<Record<string, string[]>>('wards', () => ({ eltern: ['spieler'] }));

  readonly security = new MockTable<Record<string, PinState>>('security', () =>
    Object.fromEntries(
      this.members.data.map((m) => [m.id, { pin: this.isPrivileged(m) ? MockDirectory.PIN : null, attempts: 0, stepUpUntil: null }]),
    ),
  );

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
    return { members: [...members, ...guardians], roles: MANAGERS };
  }

  activeIds(): string[] {
    return this.members.data.filter((m) => m.active).map((m) => m.id);
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
    if (!allowIncompleteProfile) {
      const gap = this.missing(member)[0];
      if (gap === 'birthDate') fail(403, 'profile.birth-date-required');
      if (gap === 'pin') fail(403, 'profile.pin-required');
    }
    return member;
  }

  hasRole(member: Member, roles: readonly Role[]): boolean {
    return member.roles.some((r) => roles.includes(r));
  }

  isPrivileged(member: Member): boolean {
    return this.hasRole(member, PRIVILEGED);
  }

  isManager(member: Member): boolean {
    return this.hasRole(member, MANAGERS);
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
    this.requirePrivileged(viewer, MANAGERS);
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

  missing(member: Member): MissingProfileField[] {
    const gaps: MissingProfileField[] = [];
    if (!member.birthDate) gaps.push('birthDate');
    if (this.isPrivileged(member) && !this.pinState(member).pin) gaps.push('pin');
    return gaps;
  }

  securityStatus(member: Member): SecurityStatus {
    const state = this.pinState(member);
    const active = state.stepUpUntil && new Date(state.stepUpUntil) > new Date() ? state.stepUpUntil : null;
    return {
      pinRequired: this.isPrivileged(member),
      pinSet: !!state.pin,
      pinLocked: state.attempts >= settings.security.maxPinAttempts,
      stepUpUntil: active,
      devices: [],
    };
  }

  setPin(member: Member, newPin: unknown, currentPin: unknown): StepUp {
    const hadPin = !!this.pinState(member).pin;
    if (hadPin) this.verifyPin(member, currentPin);
    this.pinState(member).pin = MockDirectory.validPin(newPin);
    this.securityChanged(member, hadPin ? 'PIN_CHANGED' : 'PIN_SET');
    return this.grantStepUp(member);
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
    this.requirePrivileged(viewer, MANAGERS);
    const roles = MockDirectory.roles(body.roles);
    if (roles.includes('ADMIN') && !this.hasRole(viewer, ['ADMIN'])) fail(403, 'access.denied');
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!/^[\x21-\x3f\x41-\x7e]+@[^@\s]+\.[^@\s]+$/.test(email) || email.includes('ß')) fail(400, 'member.email-invalid');
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
    };
    if (body.birthDate) this.applyProfile(member, { birthDate: body.birthDate });
    this.members.data.push(member);
    this.members.save();
    mockServer.events.publish({ type: 'members.member-invited', data: { memberId: member.id }, audience: { roles: MANAGERS } });
    return member;
  }

  setRoles(viewer: Member, memberId: string, rawRoles: unknown): Member {
    this.requirePrivileged(viewer, ['ADMIN']);
    const roles = MockDirectory.roles(rawRoles);
    if (viewer.id === memberId && !roles.includes('ADMIN')) fail(409, 'member.cannot-remove-own-admin');
    const target = this.members.data.find((m) => m.id === memberId) ?? fail(404, 'member.not-found');
    target.roles = roles;
    this.members.save();
    return this.visibleTo(viewer, target);
  }

  deactivate(viewer: Member, memberId: string): Member {
    this.requirePrivileged(viewer, MANAGERS);
    if (viewer.id === memberId) fail(409, 'member.cannot-deactivate-self');
    const target = this.members.data.find((m) => m.id === memberId) ?? fail(404, 'member.not-found');
    if (target.roles.includes('ADMIN') && !this.hasRole(viewer, ['ADMIN'])) fail(403, 'access.denied');
    target.active = false;
    this.members.save();
    mockServer.events.publish({ type: 'members.member-deactivated', data: { memberId }, audience: { roles: MANAGERS } });
    // server: TeamHandlers.onMemberDeactivated
    for (const teamId of Object.keys(this.teamRoles(memberId))) this.removeFromTeamUnchecked(teamId, memberId);
    return this.visibleTo(viewer, target);
  }

  linkGuardian(viewer: Member, minorId: string, guardianId: unknown): Member {
    this.requirePrivileged(viewer, MANAGERS);
    if (typeof guardianId !== 'string') return fail(400, 'request.invalid');
    if (guardianId === minorId) fail(400, 'member.guardian-is-self');
    if (!this.members.data.some((m) => m.id === guardianId && m.active)) fail(404, 'member.not-found');
    const minor = this.members.data.find((m) => m.id === minorId) ?? fail(404, 'member.not-found');
    const wards = (this.wards.data[guardianId] ??= []);
    if (!wards.includes(minorId)) wards.push(minorId);
    this.wards.save();
    return this.visibleTo(viewer, minor);
  }

  resetSecurity(viewer: Member, memberId: string): void {
    this.requirePrivileged(viewer, ['ADMIN']);
    const target = this.members.data.find((m) => m.id === memberId) ?? fail(404, 'member.not-found');
    this.security.data[target.id] = { pin: null, attempts: 0, stepUpUntil: null };
    this.security.save();
    this.securityChanged(target, 'RESET_BY_ADMIN');
  }

  resetAllSecurity(viewer: Member, confirm: unknown): { pinsReset: number } {
    if (confirm !== settings.members.resetAllConfirmation) fail(400, 'request.confirmation-missing');
    this.requirePrivileged(viewer, ['ADMIN']);
    let pinsReset = 0;
    for (const member of this.members.data) {
      if (this.pinState(member).pin) pinsReset++;
      this.security.data[member.id] = { pin: null, attempts: 0, stepUpUntil: null };
      if (member.active && this.isPrivileged(member)) this.securityChanged(member, 'RESET_BY_ADMIN');
    }
    this.security.save();
    return { pinsReset };
  }

  // --- teams admin (server: TeamHandlers) ---

  createTeam(viewer: Member, body: Record<string, unknown>): Team {
    this.requirePrivileged(viewer, MANAGERS);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > settings.teams.nameMaxLength) fail(400, 'team.name-invalid');
    if (typeof body.season !== 'string' || !new RegExp(settings.teams.seasonPattern).test(body.season)) fail(400, 'team.season-invalid');
    if (this.teams.data.some((t) => t.name === name && t.season === body.season)) fail(409, 'team.exists');
    const team: Team = { id: crypto.randomUUID(), name, season: body.season as string };
    this.teams.data.push(team);
    this.teams.save();
    return team;
  }

  /** Admin/board only; a coach of the team gets 403, everyone else 404. Also changes the role of existing members. */
  setTeamMember(viewer: Member, teamId: string, memberId: string, teamRole: unknown): Roster {
    if (!this.teams.data.some((t) => t.id === teamId)) fail(404, 'team.not-found');
    // Not coaches: membership would let them read any member's birth date and contact data.
    if (!this.isManager(viewer)) {
      if (this.teamRoles(viewer.id)[teamId] === 'COACH') fail(403, 'access.denied');
      fail(404, 'team.not-found');
    }
    this.requirePrivileged(viewer, MANAGERS);
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
      this.requirePrivileged(viewer, MANAGERS);
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
      audience: { members: [...this.teamMembers(teamId), memberId], roles: MANAGERS },
    });
  }

  private static name(value: unknown, code: string): string {
    const name = typeof value === 'string' ? value.trim() : '';
    if (!name || name.length > settings.members.nameMaxLength) return fail(400, code);
    return name;
  }

  private static roles(value: unknown): Role[] {
    const all: readonly Role[] = ['ADMIN', 'BOARD', 'COACH', 'PLAYER', 'PARENT', 'VOLUNTEER'];
    if (!Array.isArray(value) || value.some((r) => !all.includes(r))) return fail(400, 'request.invalid');
    return [...new Set(value as Role[])];
  }

  /** server: MembersApi.SecurityChanged (internal; the notifications mock turns it into a message) */
  private securityChanged(member: Member, change: 'PIN_SET' | 'PIN_CHANGED' | 'PIN_LOCKED' | 'RESET_BY_ADMIN'): void {
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
      this.requirePrivileged(viewer, MANAGERS);
    }
    if (!target) return fail(404, 'member.not-found');
    this.applyProfile(target, patch);
    return this.visibleTo(viewer, target);
  }

  private applyProfile(member: Member, patch: Record<string, unknown>): Member {
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
    } else if (phone !== undefined) {
      member.phone = null;
    }
    if (firstName !== undefined) member.firstName = MockDirectory.name(firstName, 'member.first-name-invalid');
    if (lastName !== undefined) member.lastName = MockDirectory.name(lastName, 'member.last-name-invalid');
    if (typeof photoConsent === 'boolean') member.photoConsent = photoConsent;
    this.members.save();
    return member;
  }

  private pinState(member: Member): PinState {
    return (this.security.data[member.id] ??= { pin: null, attempts: 0, stepUpUntil: null });
  }

  private verifyPin(member: Member, pin: unknown): void {
    const state = this.pinState(member);
    const max = settings.security.maxPinAttempts;
    if (!state.pin) fail(400, 'auth.pin-not-set');
    if (state.attempts >= max) fail(403, 'auth.pin-locked');
    if (pin !== state.pin) {
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
    return { member, teams: directory.teams.data.filter((t) => t.id in own), missing: directory.missing(member), wardIds: directory.wardsOf(member.id) };
  })
  // Own profile also works before onboarding is complete (birth date step).
  .on('PATCH', '/api/v1/members/:id', (req) => {
    const viewer = directory.actor(req, req.params.id === directory.findActive(req.email)?.id);
    return directory.updateProfile(viewer, req.params.id, req.body ?? {});
  })
  .on('GET', '/api/v1/me/security', (req) => directory.securityStatus(directory.actor(req, true)))
  .on('PUT', '/api/v1/me/pin', (req) => directory.setPin(directory.actor(req, true), req.body?.newPin, req.body?.currentPin))
  .on('POST', '/api/v1/me/step-up', (req) => directory.stepUp(directory.actor(req), req.body?.pin))
  .on('GET', '/api/v1/teams', (req) => {
    const member = directory.actor(req);
    const own = directory.teamRoles(member.id);
    const mine = req.query.get('mine') === 'true';
    return { items: directory.teams.data.filter((t) => !mine || t.id in own) };
  })
  .on('GET', '/api/v1/teams/:id/roster', (req) => directory.roster(directory.actor(req), req.params.id))
  .on('GET', '/api/v1/members', (req) => directory.list(directory.actor(req)));
