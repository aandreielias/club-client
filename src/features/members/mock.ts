// Member admin endpoints of the mock server (rules live in MockDirectory, like the server's MemberHandlers; offices and membership
// kinds in MockBoard, like MembershipHandlers).
import { generatedKey } from '../../lib/mock/keys';
import { directory, MockDirectory, OFFICES, type OfficeRow } from '../../lib/mock/core';
import { MockServer, mockServer, type MockRequest } from '../../lib/mock/MockServer';
import { MockTable } from '../../lib/mock/MockTable';
import { ADMIN_BOARD, type Member } from '../../lib/types';
import { settings } from '../../settings';
import { HONORARY, type BoardSettings, type ChangeField, type ChangeRequest, type MembershipKind, type OfficePair } from './MembersApi';

const plusYears = (date: string, years: number): string => `${Number(date.slice(0, 4)) + years}${date.slice(4)}`;

/** server: MembershipHandlers — membership kinds, board settings and offices; the tables stay on the directory, which every mock reads. */
export class MockBoard {
  constructor(private readonly people: MockDirectory) {}

  /** server: JdbcMemberRepository.membershipKindInUse — held now, or remembered for a revoke. */
  private inUse(key: string): boolean {
    return this.people.members.data.some((m) => m.membershipTypes.includes(key) || m.previousType === key);
  }

  listMembershipKinds(): { items: MembershipKind[] } {
    const items = [...this.people.membershipKinds.data].sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label));
    return { items: items.map((k) => ({ ...k, inUse: this.inUse(k.key), fixed: k.key === HONORARY })) };
  }

  /** server: MembershipHandlers.saveKind */
  saveMembershipKind(viewer: Member, key: string | null, body: Record<string, any>): MembershipKind {
    this.people.requirePrivileged(viewer, ADMIN_BOARD);
    if (key && !this.people.membershipKinds.data.some((k) => k.key === key)) fail(404, 'membership-kind.not-found');
    const label = typeof body.label === 'string' ? body.label.trim() : '';
    if (!label || label.length > 40) fail(400, 'membership-kind.label-invalid');
    if (!Number.isInteger(body.sort) || body.sort < 0 || body.sort > 1000) fail(400, 'membership-kind.sort-invalid');
    if (key === HONORARY && body.archived) fail(409, 'membership-kind.fixed');
    const kind: MembershipKind = { key: key ?? generatedKey('KIND'), label,
      votes: !!body.votes, eligible: !!body.eligible, sort: body.sort, archived: !!body.archived, inUse: false, fixed: key === HONORARY };
    const next = [...this.people.membershipKinds.data.filter((k) => k.key !== kind.key), kind];
    this.people.requireHoldersEligible(next);
    this.people.membershipKinds.data.splice(0, this.people.membershipKinds.data.length, ...next);
    this.people.membershipKinds.save();
    this.people.saveMembers();
    mockServer.events.publish({ type: 'members.membership-kinds-changed', data: {} });
    return { ...kind, inUse: this.inUse(kind.key) };
  }

  deleteMembershipKind(viewer: Member, key: string): void {
    this.people.requirePrivileged(viewer, ADMIN_BOARD);
    const index = this.people.membershipKinds.data.findIndex((k) => k.key === key);
    if (index < 0) fail(404, 'membership-kind.not-found');
    if (key === HONORARY) fail(409, 'membership-kind.fixed');
    if (this.inUse(key)) fail(409, 'membership-kind.in-use');
    this.people.membershipKinds.data.splice(index, 1);
    this.people.membershipKinds.save();
    mockServer.events.publish({ type: 'members.membership-kinds-changed', data: {} });
  }

  board(): { offices: (OfficeRow & { name: string })[]; warnings: string[] } {
    const running = this.people.running();
    const people = new Set(running.filter((o) => o.office !== 'AUDITOR').map((o) => o.memberId));
    const warnings: string[] = [];
    const settings = this.people.boardSettings.data;
    // server: BoardRules.warnings
    if (people.size < settings.minBoardSize) warnings.push('board.too-small');
    else if (settings.oddBoardSize && people.size % 2 === 0) warnings.push('board.even');
    for (const s of settings.offices) {
      if (s.enabled && running.filter((o) => o.office === s.office).length < s.minHolders) {
        warnings.push(s.office === 'AUDITOR' ? 'board.auditors-missing' : `board.${s.office.toLowerCase().replace('_', '-')}-missing`);
      }
    }
    const offices = running
      .map((o) => ({ ...o, name: this.people.displayName(o.memberId) }))
      .sort((a, b) => OFFICES.indexOf(a.office) - OFFICES.indexOf(b.office) || a.startsOn.localeCompare(b.startsOn));
    return { offices, warnings };
  }

  /** server: MembershipHandlers.saveSettings and BoardRules.validate. */
  saveBoardSettings(viewer: Member, body: Record<string, any>): BoardSettings {
    this.people.requirePrivileged(viewer, ADMIN_BOARD);
    const list: Record<string, any>[] = Array.isArray(body.offices) ? body.offices : [];
    if (list.length !== OFFICES.length || new Set(list.map((o) => o.office)).size !== OFFICES.length || list.some((o) => !OFFICES.includes(o.office))) {
      fail(400, 'board-settings.offices-invalid');
    }
    const int = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
    const offices = OFFICES.map((kind) => {
      const o = list.find((x) => x.office === kind)!;
      const label = typeof o.label === 'string' ? o.label.trim() : '';
      if (!label || label.length > 40) fail(400, 'board-settings.label-invalid');
      const max = o.maxHolders ?? null;
      if (!int(o.minHolders, 0, 20) || (max != null && (!int(max, Math.max(1, o.minHolders), 20))) || (!o.enabled && o.minHolders > 0)) {
        fail(400, 'board-settings.holders-invalid');
      }
      if (!int(o.termYears, 1, 10)) fail(400, 'board-settings.term-invalid');
      return { office: kind, label, enabled: !!o.enabled, minHolders: o.minHolders, maxHolders: max, termYears: o.termYears };
    });
    const combinations: OfficePair[] = Array.isArray(body.combinations) ? body.combinations : fail(400, 'board-settings.combination-invalid');
    if (combinations.some((p) => !p || !OFFICES.includes(p.a) || !OFFICES.includes(p.b) || p.a === p.b)) {
      fail(400, 'board-settings.combination-invalid');
    }
    if (!offices[0].enabled) fail(400, 'board-settings.chair-required');
    if (!int(body.minBoardSize, 1, 20) || !int(body.cooptWeeks, 0, 52) || !int(body.termWarningDays, 1, 365) || !int(body.byElectionDays, 1, 365)) {
      fail(400, 'board-settings.board-invalid');
    }
    if (!body.multipleKinds && this.people.members.data.some((m) => m.membershipTypes.length > 1)) fail(409, 'member.several-kinds');
    this.people.requireHoldersEligible(this.people.membershipKinds.data);
    Object.assign(this.people.boardSettings.data, { offices, minBoardSize: body.minBoardSize, oddBoardSize: !!body.oddBoardSize, cooptWeeks: body.cooptWeeks,
      termWarningDays: body.termWarningDays, byElectionDays: body.byElectionDays, combinations: combinations.map(({ a, b }) => ({ a, b })),
      multipleKinds: !!body.multipleKinds });
    this.people.boardSettings.save();
    this.people.saveMembers();
    mockServer.events.publish({ type: 'members.board-settings-changed', data: {} });
    return this.people.boardSettings.data;
  }

  assignOffice(viewer: Member, body: Record<string, any>): OfficeRow & { name: string } {
    this.people.requirePrivileged(viewer, ADMIN_BOARD);
    const office = body.office as OfficeRow['office'];
    if (!OFFICES.includes(office) || typeof body.startsOn !== 'string') return fail(400, 'request.invalid');
    if (body.startsOn > this.people.clock.today()) fail(400, 'office.start-in-future');
    const setting = this.people.boardSettings.data.offices.find((o) => o.office === office)!;
    const termEndsOn = typeof body.termEndsOn === 'string' && body.termEndsOn ? body.termEndsOn : plusYears(body.startsOn, setting.termYears);
    if (termEndsOn <= body.startsOn || termEndsOn > plusYears(body.startsOn, setting.termYears)) fail(400, 'office.term-invalid');
    const holder = this.people.members.data.find((m) => m.id === body.memberId && m.active) ?? fail(404, 'member.not-found');
    if (!this.people.rights(holder).eligible) fail(409, 'office.not-eligible');
    const running = this.people.running();
    if (!setting.enabled) fail(409, 'office.disabled');
    if (setting.maxHolders != null && running.filter((o) => o.office === office).length >= setting.maxHolders) fail(409, 'office.taken');
    const held = running.filter((o) => o.memberId === holder.id).map((o) => o.office);
    if (held.includes(office)) fail(409, 'office.already-held');
    const allowed = (x: string, y: string) => this.people.boardSettings.data.combinations.some((p) => (p.a === x && p.b === y) || (p.a === y && p.b === x));
    if (held.some((h) => !allowed(h, office))) fail(409, 'office.combination');
    const row: OfficeRow = { id: crypto.randomUUID(), memberId: holder.id, office, startsOn: body.startsOn, termEndsOn, endedOn: null, coopted: body.coopted === true };
    this.people.offices.data.push(row);
    this.people.offices.save();
    this.people.syncBoardRole(holder);
    mockServer.events.publish({ type: 'members.office-assigned', data: { memberId: holder.id, office } });
    return { ...row, name: this.people.displayName(holder.id) };
  }

  endOffice(viewer: Member, officeId: string): OfficeRow & { name: string } {
    this.people.requirePrivileged(viewer, ADMIN_BOARD);
    const row = this.people.offices.data.find((o) => o.id === officeId) ?? fail(404, 'office.not-found');
    if (row.endedOn) fail(409, 'office.already-ended');
    row.endedOn = this.people.clock.today();
    this.people.offices.save();
    const holder = this.people.members.data.find((m) => m.id === row.memberId);
    if (holder) this.people.syncBoardRole(holder);
    return { ...row, name: this.people.displayName(row.memberId) };
  }

  /** server: MembersApi.ELECTORATE — voters of a general meeting, the board, or every club member. */
}

export const board = new MockBoard(directory);

mockServer
  .on('POST', '/api/v1/members', (req) => directory.invite(directory.actor(req), req.body ?? {}))
  .on('GET', '/api/v1/members/:id', (req) => directory.get(directory.actor(req), req.params.id))
  .on('PUT', '/api/v1/members/:id/roles', (req) => directory.setRoles(directory.actor(req), req.params.id, req.body?.roles))
  .on('POST', '/api/v1/members/:id/deactivate', (req) => directory.deactivate(directory.actor(req), req.params.id))
  .on('POST', '/api/v1/members/:id/guardians', (req) => directory.linkGuardian(directory.actor(req), req.params.id, req.body?.guardianId))
  .on('GET', '/api/v1/members/:id/family', (req) => directory.family(directory.actor(req), req.params.id))
  .on('GET', '/api/v1/members/:id/guardians', (req) => directory.listGuardians(directory.actor(req), req.params.id))
  .on('DELETE', '/api/v1/members/:id/guardians/:guardianId', (req) => directory.unlinkGuardian(directory.actor(req), req.params.id, req.params.guardianId))
  .on('POST', '/api/v1/members/:id/reactivate', (req) => directory.reactivate(directory.actor(req), req.params.id))
  .on('POST', '/api/v1/members/:id/erase', (req) => {
    directory.erase(directory.actor(req), req.params.id);
    // server: MemberHandlers.erase publishes MEMBER_ERASED with the deleted change requests; every module drops its data
    mockServer.events.publish({ type: 'members.member-erased', data: { memberId: req.params.id, changeRequestIds: changeRequests.deleteOf(req.params.id) } });
  })
  .on('POST', '/api/v1/members/:id/security/reset', (req) => directory.resetSecurity(directory.actor(req), req.params.id))
  .on('PUT', '/api/v1/members/:id/membership', (req) => directory.setMembership(directory.actor(req), req.params.id, req.body ?? {}))
  .on('GET', '/api/v1/board/offices', (req) => {
    directory.actor(req);
    return board.board();
  })
  .on('GET', '/api/v1/membership-kinds', (req) => (directory.actor(req), board.listMembershipKinds()))
  .on('POST', '/api/v1/membership-kinds', (req) => board.saveMembershipKind(directory.actor(req), null, req.body ?? {}))
  .on('PUT', '/api/v1/membership-kinds/:key', (req) => board.saveMembershipKind(directory.actor(req), req.params.key, req.body ?? {}))
  .on('DELETE', '/api/v1/membership-kinds/:key', (req) => board.deleteMembershipKind(directory.actor(req), req.params.key))
  .on('GET', '/api/v1/board/settings', (req) => (directory.actor(req), directory.boardSettings.data))
  .on('PUT', '/api/v1/board/settings', (req) => board.saveBoardSettings(directory.actor(req), req.body ?? {}))
  .on('POST', '/api/v1/board/offices', (req) => board.assignOffice(directory.actor(req), req.body ?? {}))
  .on('POST', '/api/v1/board/offices/:id/end', (req) => board.endOffice(directory.actor(req), req.params.id));

/** server: ChangeRequestHandlers. Requests become tasks (tasks mock) and decisions notifications (notifications mock). */
export class MockChangeRequests {
  readonly requests = new MockTable<ChangeRequestRow[]>('change-requests', () => []);

  constructor(private readonly people: MockDirectory) {}

  /** server: ChangeRequestRepository.deleteOf (GDPR erasure) */
  deleteOf(memberId: string): string[] {
    const ids = this.requests.data.filter((r) => r.memberId === memberId).map((r) => r.id);
    const kept = this.requests.data.filter((r) => r.memberId !== memberId);
    this.requests.data.splice(0, this.requests.data.length, ...kept);
    this.requests.save();
    return ids;
  }

  request(member: Member, body: Record<string, unknown>): ChangeRequest {
    const field = body.field as ChangeField;
    if (!FIELDS.includes(field)) return fail(400, 'change-request.field-missing');
    const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null;
    if ((note?.length ?? 0) > settings.members.changeNoteMaxLength) fail(400, 'change-request.note-too-long');
    const newValue = this.normalized(member, field, body.value);
    if (field === 'EMAIL' && newValue !== member.email && this.people.members.data.some((m) => m.email === newValue)) fail(409, 'member.email-taken');
    if (this.requests.data.some((r) => r.memberId === member.id && r.field === field && r.status === 'OPEN')) fail(409, 'change-request.open-exists');
    const row: ChangeRequestRow = {
      id: crypto.randomUUID(), memberId: member.id, field, newValue, note, status: 'OPEN', decidedBy: null,
      createdAt: new Date().toISOString(), decidedAt: null,
    };
    this.requests.data.unshift(row);
    this.requests.save();
    mockServer.events.publish({
      type: 'members.change-requested',
      data: { requestId: row.id, memberId: member.id, memberName: `${member.firstName} ${member.lastName}`, field, newValue },
    });
    return this.dto(row);
  }

  own(member: Member): { items: ChangeRequest[] } {
    return { items: this.requests.data.filter((r) => r.memberId === member.id && r.status === 'OPEN').map((r) => this.dto(r)) };
  }

  get(viewer: Member, id: string): ChangeRequest {
    this.people.requireRole(viewer, ADMIN_BOARD);
    return this.dto(this.find(id));
  }

  decide(viewer: Member, id: string, approve: boolean): ChangeRequest {
    this.people.requirePrivileged(viewer, ADMIN_BOARD);
    const row = this.find(id);
    if (row.status !== 'OPEN') fail(409, 'change-request.decided');
    if (approve) {
      const member = this.member(row.memberId);
      if (row.field === 'EMAIL') this.people.moveLogin(member, row.newValue);
      else this.people.applyProfile(member, { [PROFILE_KEYS[row.field]]: row.newValue });
    }
    Object.assign(row, { status: approve ? 'APPROVED' : 'REJECTED', decidedBy: viewer.id, decidedAt: new Date().toISOString() });
    this.requests.save();
    mockServer.events.publish({
      type: 'members.change-decided',
      data: { requestId: row.id, memberId: row.memberId, field: row.field, approved: approve, decidedBy: viewer.id },
    });
    return this.dto(row);
  }

  /** Same checks as the change itself, on a copy (server: ChangeRequest.open). */
  private normalized(member: Member, field: ChangeField, value: unknown): string {
    if (typeof value !== 'string' || !value.trim()) return fail(400, 'change-request.value-missing');
    if (field === 'EMAIL') return MockDirectory.email(value);
    const copy = this.people.applyProfileCopy(member, { [PROFILE_KEYS[field]]: value.trim() });
    return String(copy[PROFILE_KEYS[field]]);
  }

  private dto(row: ChangeRequestRow): ChangeRequest {
    const member = this.member(row.memberId);
    const current = { EMAIL: member.email, FIRST_NAME: member.firstName, LAST_NAME: member.lastName, BIRTH_DATE: member.birthDate }[row.field];
    return { ...row, memberName: `${member.firstName} ${member.lastName}`, currentValue: current };
  }

  private member(id: string): Member {
    return this.people.members.data.find((m) => m.id === id) ?? fail(404, 'member.not-found');
  }

  private find(id: string): ChangeRequestRow {
    return this.requests.data.find((r) => r.id === id) ?? fail(404, 'change-request.not-found');
  }
}

type ChangeRequestRow = Omit<ChangeRequest, 'memberName' | 'currentValue'>;
const FIELDS: readonly ChangeField[] = ['EMAIL', 'FIRST_NAME', 'LAST_NAME', 'BIRTH_DATE'];
const PROFILE_KEYS = { FIRST_NAME: 'firstName', LAST_NAME: 'lastName', BIRTH_DATE: 'birthDate', EMAIL: 'email' } as const;
const fail = MockServer.fail;

export const changeRequests = new MockChangeRequests(directory);
const actor = (req: MockRequest) => directory.actor(req);

mockServer
  .on('PUT', '/api/v1/members/:id/email', (req) => directory.changeEmail(actor(req), req.params.id, req.body?.email))
  .on('POST', '/api/v1/me/change-requests', (req) => changeRequests.request(actor(req), req.body ?? {}))
  .on('GET', '/api/v1/me/change-requests', (req) => changeRequests.own(actor(req)))
  .on('GET', '/api/v1/members/change-requests/:id', (req) => changeRequests.get(actor(req), req.params.id))
  .on('POST', '/api/v1/members/change-requests/:id/approve', (req) => changeRequests.decide(actor(req), req.params.id, true))
  .on('POST', '/api/v1/members/change-requests/:id/reject', (req) => changeRequests.decide(actor(req), req.params.id, false));
