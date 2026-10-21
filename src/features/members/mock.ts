// Member admin endpoints of the mock server (rules live in MockDirectory, like the server's MemberHandlers).
import { directory, MockDirectory } from '../../lib/mock/core';
import { MockServer, mockServer, type MockRequest } from '../../lib/mock/MockServer';
import { MockTable } from '../../lib/mock/MockTable';
import { ADMIN_BOARD, type Member } from '../../lib/types';
import { settings } from '../../settings';
import type { ChangeField, ChangeRequest } from './MembersApi';

mockServer
  .on('POST', '/api/v1/members', (req) => directory.invite(directory.actor(req), req.body ?? {}))
  .on('GET', '/api/v1/members/:id', (req) => directory.get(directory.actor(req), req.params.id))
  .on('PUT', '/api/v1/members/:id/roles', (req) => directory.setRoles(directory.actor(req), req.params.id, req.body?.roles))
  .on('POST', '/api/v1/members/:id/deactivate', (req) => directory.deactivate(directory.actor(req), req.params.id))
  .on('POST', '/api/v1/members/:id/guardians', (req) => directory.linkGuardian(directory.actor(req), req.params.id, req.body?.guardianId))
  .on('GET', '/api/v1/members/:id/guardians', (req) => directory.listGuardians(directory.actor(req), req.params.id))
  .on('DELETE', '/api/v1/members/:id/guardians/:guardianId', (req) => directory.unlinkGuardian(directory.actor(req), req.params.id, req.params.guardianId))
  .on('POST', '/api/v1/members/:id/reactivate', (req) => directory.reactivate(directory.actor(req), req.params.id))
  .on('POST', '/api/v1/members/:id/erase', (req) => directory.erase(directory.actor(req), req.params.id))
  .on('POST', '/api/v1/members/:id/security/reset', (req) => directory.resetSecurity(directory.actor(req), req.params.id));

/** server: ChangeRequestHandlers. Requests become tasks (tasks mock) and decisions notifications (notifications mock). */
export class MockChangeRequests {
  readonly requests = new MockTable<ChangeRequestRow[]>('change-requests', () => []);

  constructor(private readonly people: MockDirectory) {}

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
