// Member admin endpoints of the mock server (rules live in MockDirectory, like the server's MemberHandlers; offices and membership
// kinds in MockBoard, like MembershipHandlers).
import { generatedKey } from '../../lib/mock/keys';
import { directory, MockDirectory, OFFICES, type OfficeRow } from '../../lib/mock/core';
import { MockServer, mockServer, type MockRequest } from '../../lib/mock/MockServer';
import { MockTable } from '../../lib/mock/MockTable';
import { ADMIN_BOARD, type Member } from '../../lib/types';
import { settings } from '../../settings';
import {
  HONORARY,
  type BoardSettings,
  type ChangeField,
  type ChangeRequest,
  type MembershipKind,
  type OfficePair,
  type OfficeSetting,
} from './MembersApi';

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
    const kind: MembershipKind = {
      key: key ?? generatedKey('KIND'),
      label,
      votes: !!body.votes,
      eligible: !!body.eligible,
      sort: body.sort,
      archived: !!body.archived,
      inUse: false,
      fixed: key === HONORARY,
    };
    const next = [...this.people.membershipKinds.data.filter((k) => k.key !== kind.key), kind];
    this.people.requireHoldersEligible(next);
    this.people.membershipKinds.data.splice(0, this.people.membershipKinds.data.length, ...next);
    this.people.membershipKinds.save();
    this.people.saveMembers();
    mockServer.events.publish({ type: 'members.membership-kinds-changed', data: {}, audience: { everyone: true } });
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
    mockServer.events.publish({ type: 'members.membership-kinds-changed', data: {}, audience: { everyone: true } });
  }

  board(): { offices: (OfficeRow & { name: string })[]; warnings: string[] } {
    const running = this.people.running();
    const people = new Set(running.filter((o) => this.people.isBoardOffice(o.office)).map((o) => o.memberId));
    const warnings: string[] = [];
    const settings = this.people.boardSettings.data;
    // server: BoardRules.warnings
    if (people.size < settings.minBoardSize) warnings.push('board.too-small');
    else if (settings.oddBoardSize && people.size % 2 === 0) warnings.push('board.even');
    for (const s of settings.offices) {
      if (s.enabled && running.filter((o) => o.office === s.office).length < s.minHolders) {
        warnings.push(
          s.office === 'AUDITOR'
            ? 'board.auditors-missing'
            : OFFICES.includes(s.office)
              ? `board.${s.office.toLowerCase().replace('_', '-')}-missing`
              : `board.office-missing:${s.office}`,
        );
      }
    }
    const offices = running
      .map((o) => ({ ...o, name: this.people.displayName(o.memberId) }))
      .sort((a, b) => this.order(a.office) - this.order(b.office) || a.startsOn.localeCompare(b.startsOn));
    return { offices, warnings };
  }

  /** The club's order of its offices (board page). */
  private order(office: string): number {
    return this.people.boardSettings.data.offices.findIndex((o) => o.office === office);
  }

  private keys(): string[] {
    return this.people.boardSettings.data.offices.map((o) => o.office);
  }

  /** server: BoardRules.validate(OfficeSetting) */
  private static office(o: Record<string, any>, office: string, board: boolean, duty: OfficeSetting['duty'] = 'NONE'): OfficeSetting {
    const int = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
    const label = typeof o.label === 'string' ? o.label.trim() : '';
    if (!label || label.length > 40) fail(400, 'board-settings.label-invalid');
    const max = o.maxHolders ?? null;
    if (!int(o.minHolders, 0, 20) || (max != null && !int(max, Math.max(1, o.minHolders), 20)) || (o.enabled === false && o.minHolders > 0)) {
      fail(400, 'board-settings.holders-invalid');
    }
    if (!int(o.termYears, 1, 10)) fail(400, 'board-settings.term-invalid');
    return { office, label, enabled: o.enabled !== false, minHolders: o.minHolders, maxHolders: max, termYears: o.termYears, board, duty };
  }

  /** server: MembershipHandlers.addOffice — key OFFICE_…, after the others, at most 40. */
  addOffice(viewer: Member, body: Record<string, any>): BoardSettings {
    this.people.requirePrivileged(viewer, ADMIN_BOARD);
    const duty = ['CHAIR', 'SECRETARY'].includes(body.duty) ? body.duty : 'NONE';
    const office = MockBoard.office({ ...body, enabled: true }, generatedKey('OFFICE'), !!body.board, duty);
    if (this.people.boardSettings.data.offices.length >= 40) fail(409, 'board-settings.too-many-offices');
    this.people.boardSettings.data.offices.push(office);
    this.people.boardSettings.save();
    mockServer.events.publish({ type: 'members.board-settings-changed', data: {}, audience: { everyone: true } });
    return this.people.boardSettings.data;
  }

  /** server: MembershipHandlers.deleteOffice — only a club office never held and named by no meeting type. */
  deleteOffice(viewer: Member, office: string, namedByMeetings: boolean): BoardSettings {
    this.people.requirePrivileged(viewer, ADMIN_BOARD);
    if (OFFICES.includes(office) || namedByMeetings || this.people.offices.data.some((o) => o.office === office)) fail(409, 'office.in-use');
    const settings = this.people.boardSettings.data;
    if (!settings.offices.some((o) => o.office === office)) fail(404, 'office.not-found');
    settings.offices = settings.offices.filter((o) => o.office !== office);
    settings.combinations = settings.combinations.filter((p) => p.a !== office && p.b !== office);
    this.people.boardSettings.save();
    mockServer.events.publish({ type: 'members.board-settings-changed', data: {}, audience: { everyone: true } });
    return settings;
  }

  /** server: MembershipHandlers.saveSettings and BoardRules.validate — every office once, in the club's order. */
  saveBoardSettings(viewer: Member, body: Record<string, any>): BoardSettings {
    this.people.requirePrivileged(viewer, ADMIN_BOARD);
    const list: Record<string, any>[] = Array.isArray(body.offices) ? body.offices : [];
    const keys = this.keys();
    if (list.length !== keys.length || new Set(list.map((o) => o.office)).size !== keys.length || list.some((o) => !keys.includes(o.office))) {
      fail(400, 'board-settings.offices-invalid');
    }
    const int = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
    const offices = list.map((o) => {
      // the seeded ones keep their place on or off the board
      if (OFFICES.includes(o.office) && o.board !== undefined && !!o.board !== (o.office !== 'AUDITOR')) fail(400, 'board-settings.offices-invalid');
      const seededDuty = o.office === 'CHAIR' ? 'CHAIR' : o.office === 'SECRETARY' ? 'SECRETARY' : 'NONE';
      if (OFFICES.includes(o.office) && o.duty !== undefined && o.duty !== seededDuty) fail(400, 'board-settings.offices-invalid');
      const duty = OFFICES.includes(o.office) ? seededDuty : ['CHAIR', 'SECRETARY'].includes(o.duty) ? o.duty : 'NONE';
      return MockBoard.office(o, o.office, OFFICES.includes(o.office) ? o.office !== 'AUDITOR' : !!o.board, duty);
    });
    const combinations: OfficePair[] = Array.isArray(body.combinations) ? body.combinations : fail(400, 'board-settings.combination-invalid');
    if (combinations.some((p) => !p || !keys.includes(p.a) || !keys.includes(p.b) || p.a === p.b)) {
      fail(400, 'board-settings.combination-invalid');
    }
    if (!offices.find((o) => o.office === 'CHAIR')!.enabled) fail(400, 'board-settings.chair-required');
    if (!int(body.minBoardSize, 1, 20) || !int(body.cooptWeeks, 0, 52) || !int(body.termWarningDays, 1, 365) || !int(body.byElectionDays, 1, 365)) {
      fail(400, 'board-settings.board-invalid');
    }
    const ages = settings.members.ages;
    if (!int(body.guardianUntilAge, ages.guardianMin, ages.guardianMax) || !int(body.ownConsentAge, ages.consentMin, body.guardianUntilAge)) {
      fail(400, 'board-settings.ages-invalid');
    }
    if (!body.multipleKinds && this.people.members.data.some((m) => m.membershipTypes.length > 1)) fail(409, 'member.several-kinds');
    this.people.requireHoldersEligible(this.people.membershipKinds.data);
    Object.assign(this.people.boardSettings.data, {
      offices,
      minBoardSize: body.minBoardSize,
      oddBoardSize: !!body.oddBoardSize,
      cooptWeeks: body.cooptWeeks,
      termWarningDays: body.termWarningDays,
      byElectionDays: body.byElectionDays,
      combinations: combinations.map(({ a, b }) => ({ a, b })),
      multipleKinds: !!body.multipleKinds,
      guardianUntilAge: body.guardianUntilAge,
      ownConsentAge: body.ownConsentAge,
    });
    this.people.boardSettings.save();
    // an office moved on or off the board changes its holders' BOARD role
    for (const m of this.people.members.data) this.people.syncBoardRole(m);
    this.people.saveMembers();
    mockServer.events.publish({ type: 'members.board-settings-changed', data: {}, audience: { everyone: true } });
    return this.people.boardSettings.data;
  }

  assignOffice(viewer: Member, body: Record<string, any>): OfficeRow & { name: string } {
    this.people.requirePrivileged(viewer, ADMIN_BOARD);
    const office = body.office as OfficeRow['office'];
    if (typeof body.startsOn !== 'string') return fail(400, 'request.invalid');
    if (!this.keys().includes(office)) fail(404, 'office.not-found');
    if (body.startsOn > plusYears(this.people.clock.today(), 1)) fail(400, 'office.start-in-future');
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
    const allowed = (x: string, y: string) =>
      this.people.boardSettings.data.combinations.some((p) => (p.a === x && p.b === y) || (p.a === y && p.b === x));
    if (held.some((h) => !allowed(h, office))) fail(409, 'office.combination');
    const row: OfficeRow = {
      id: crypto.randomUUID(),
      memberId: holder.id,
      office,
      startsOn: body.startsOn,
      termEndsOn,
      endedOn: null,
      coopted: body.coopted === true,
    };
    this.people.offices.data.push(row);
    this.people.offices.save();
    this.people.syncBoardRole(holder);
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

/** server: MeetingsApi.OFFICE_IN_USE — the meetings mock registers its check (no import cycle). */
export const officeUses: ((office: string) => boolean)[] = [];
const officeNamedByMeetings = (office: string): boolean => officeUses.some((uses) => uses(office));

/** server: members_member.first_login_at — invited through the mock and never "signed in" (seeded members all have). */
const pendingInvites = new Set<string>();

mockServer
  .on('GET', '/api/v1/members/invitations', (req) => {
    directory.requireRole(directory.actor(req), ADMIN_BOARD);
    return { ids: [...pendingInvites].filter((id) => directory.members.data.some((m) => m.id === id && m.active)) };
  })
  .on('POST', '/api/v1/members/:id/invite', (req) => {
    directory.requirePrivileged(directory.actor(req), ADMIN_BOARD);
    directory.get(directory.actor(req), req.params.id);
    const member = directory.members.data.find((m) => m.id === req.params.id)!;
    // server: MemberHandlers.resendInvite — without a login the first invitation, once an e-mail is set
    if (!member.login) {
      if (!member.email) fail(409, 'member.email-missing');
      member.login = true;
      directory.saveMembers();
      pendingInvites.add(member.id);
      return;
    }
    if (!pendingInvites.has(req.params.id)) fail(409, 'member.already-signed-in');
  })
  .on('POST', '/api/v1/members', (req) => {
    const member = directory.invite(directory.actor(req), req.body ?? {});
    if (member.login) pendingInvites.add(member.id);
    return member;
  })
  .on('GET', '/api/v1/members/:id', (req) => directory.get(directory.actor(req), req.params.id))
  .on('PUT', '/api/v1/members/:id/roles', (req) => directory.setRoles(directory.actor(req), req.params.id, req.body?.roles))
  .on('POST', '/api/v1/members/:id/deactivate', (req) => directory.deactivate(directory.actor(req), req.params.id))
  .on('POST', '/api/v1/members/:id/guardians', (req) => directory.linkGuardian(directory.actor(req), req.params.id, req.body?.guardianId))
  .on('GET', '/api/v1/members/:id/family', (req) => directory.family(directory.actor(req), req.params.id))
  .on('GET', '/api/v1/members/:id/guardians', (req) => directory.listGuardians(directory.actor(req), req.params.id))
  .on('DELETE', '/api/v1/members/:id/guardians/:guardianId', (req) =>
    directory.unlinkGuardian(directory.actor(req), req.params.id, req.params.guardianId),
  )
  .on('POST', '/api/v1/members/:id/reactivate', (req) => directory.reactivate(directory.actor(req), req.params.id))
  .on('POST', '/api/v1/members/:id/erase', (req) => {
    directory.erase(directory.actor(req), req.params.id);
    // server: MemberHandlers.erase publishes MEMBER_ERASED with the deleted change requests; every module drops its data
    mockServer.events.publish({
      type: 'members.member-erased',
      data: { memberId: req.params.id, changeRequestIds: changeRequests.deleteOf(req.params.id) },
    });
  })
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
  .on('POST', '/api/v1/board/settings/offices', (req) => board.addOffice(directory.actor(req), req.body ?? {}))
  .on('DELETE', '/api/v1/board/settings/offices/:office', (req) =>
    board.deleteOffice(directory.actor(req), req.params.office, officeNamedByMeetings(req.params.office)),
  )
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
      id: crypto.randomUUID(),
      memberId: member.id,
      field,
      newValue,
      note,
      status: 'OPEN',
      decidedBy: null,
      createdAt: new Date().toISOString(),
      decidedAt: null,
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
    if (field === 'MIDDLE_NAME' && typeof value === 'string' && !value.trim()) return ''; // server: empty removes it
    if (typeof value !== 'string' || !value.trim()) return fail(400, 'change-request.value-missing');
    if (field === 'EMAIL') return MockDirectory.email(value);
    const copy = this.people.applyProfileCopy(member, { [PROFILE_KEYS[field]]: value.trim() });
    return String(copy[PROFILE_KEYS[field]] ?? '');
  }

  private dto(row: ChangeRequestRow): ChangeRequest {
    const member = this.member(row.memberId);
    const current = {
      EMAIL: member.email,
      FIRST_NAME: member.firstName,
      MIDDLE_NAME: member.middleName,
      LAST_NAME: member.lastName,
      BIRTH_DATE: member.birthDate,
    }[row.field];
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
const FIELDS: readonly ChangeField[] = ['EMAIL', 'FIRST_NAME', 'MIDDLE_NAME', 'LAST_NAME', 'BIRTH_DATE'];
const PROFILE_KEYS = { FIRST_NAME: 'firstName', MIDDLE_NAME: 'middleName', LAST_NAME: 'lastName', BIRTH_DATE: 'birthDate', EMAIL: 'email' } as const;
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
