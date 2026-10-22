// Mock of the club-server meetings module (MeetingHandlers, MeetingRules).
import { directory, type MockDirectory } from '../../lib/mock/core';
import { MockServer, mockServer, type MockRequest } from '../../lib/mock/MockServer';
import { MockTable } from '../../lib/mock/MockTable';
import { ADMIN_BOARD, type Member } from '../../lib/types';
import type { OfficeKind } from '../members/MembersApi';
import { isAssembly, latestInvite, type Meeting, type MeetingKind, type MeetingSummary, type PresenceMode } from './model';

const fail = MockServer.fail;
const KINDS: readonly MeetingKind[] = ['ASSEMBLY', 'EXTRA_ASSEMBLY', 'BOARD', 'EXTRA_BOARD', 'SIMPLE_BOARD', 'CONSTITUENT_BOARD'];
const DAY = 86_400_000;
const GRACE = 30 * 60_000;

type StoredMeeting = Omit<Meeting, 'latestInvite' | 'electorate' | 'present' | 'quorate' | 'canManage'> & { presence: Record<string, PresenceMode> };

const text = (value: unknown, max: number, code: string): string | null => {
  if (value == null) return null;
  const t = String(value).trim();
  if (t.length > max) fail(400, code);
  return t || null;
};

export class MockMeetings {
  readonly meetings = new MockTable<StoredMeeting[]>('meetings', () => MockMeetings.seed());

  constructor(private readonly people: MockDirectory) {}

  /** A general meeting still to invite, and a simple board meeting already invited. */
  private static seed(): StoredMeeting[] {
    const at = (days: number, hour: number) => {
      const d = new Date(Date.now() + days * DAY);
      d.setUTCHours(hour, 0, 0, 0);
      return d.toISOString();
    };
    const base = { urgency: null, videoUrl: null, openedAt: null, closedAt: null, protocol: null, presence: {} };
    return [
      { ...base, id: 'mt-mv', kind: 'ASSEMBLY', title: 'Ordentliche Mitgliederversammlung', agenda: '1. Begrüßung\n2. Bericht des Vorstands\n3. Rechnungsabschluss\n4. Mitgliedsbeiträge',
        startsAt: at(30, 17), endsAt: at(30, 19), location: 'Vereinsheim', status: 'DRAFT', invitedAt: null },
      { ...base, id: 'mt-vs', kind: 'SIMPLE_BOARD', title: 'Vorstandssitzung', agenda: '1. Hallenzeiten\n2. Aufnahmeanträge',
        startsAt: at(10, 18), endsAt: at(10, 19), location: null, videoUrl: 'https://meet.example.at/vorstand', status: 'INVITED', invitedAt: new Date().toISOString() },
    ];
  }

  list(viewer: Member, from: string | null, to: string | null): { items: MeetingSummary[] } {
    return {
      items: this.meetings.data
        .filter((m) => this.maySee(viewer, m) && (!from || m.startsAt >= from) && (!to || m.startsAt < to))
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
        .map(({ id, kind, title, startsAt, endsAt, location, status }) => ({ id, kind, title, startsAt, endsAt, location, status })),
    };
  }

  get(viewer: Member, id: string): Meeting {
    return this.dto(viewer, this.visible(viewer, id));
  }

  create(viewer: Member, body: Record<string, any>): Meeting {
    this.people.requirePrivileged(viewer, ADMIN_BOARD);
    const kind = body.kind as MeetingKind;
    if (!KINDS.includes(kind)) return fail(400, 'request.invalid');
    if (!this.mayConvene(viewer, kind)) fail(403, 'meeting.may-not-convene');
    const meeting: StoredMeeting = {
      id: crypto.randomUUID(), kind, title: '', agenda: null, urgency: null, startsAt: '', endsAt: '', location: null, videoUrl: null,
      status: 'DRAFT', invitedAt: null, openedAt: null, closedAt: null, protocol: null, presence: {},
    };
    this.apply(meeting, body);
    this.meetings.data.push(meeting);
    this.changed(meeting, 'CREATED');
    return this.dto(viewer, meeting);
  }

  update(viewer: Member, id: string, body: Record<string, any>): Meeting {
    const meeting = this.managed(viewer, id);
    if (meeting.status === 'CLOSED') fail(409, 'meeting.closed');
    const moves = (body.startsAt && body.startsAt !== meeting.startsAt) || (body.endsAt && body.endsAt !== meeting.endsAt);
    if (moves && meeting.status !== 'DRAFT') fail(409, 'meeting.invited-time-fixed');
    if (body.protocol != null && meeting.status !== 'OPEN') fail(409, 'meeting.not-open');
    this.apply(meeting, body);
    this.changed(meeting, 'UPDATED');
    return this.dto(viewer, meeting);
  }

  delete(viewer: Member, id: string): void {
    const meeting = this.managed(viewer, id);
    if (meeting.status !== 'DRAFT') fail(409, 'meeting.not-draft');
    this.meetings.data.splice(this.meetings.data.indexOf(meeting), 1);
    this.changed(meeting, 'DELETED');
  }

  invite(viewer: Member, id: string): Meeting {
    const meeting = this.managed(viewer, id);
    if (meeting.status !== 'DRAFT') fail(409, 'meeting.already-invited');
    if (new Date().toISOString() > latestInvite(meeting.kind, meeting.startsAt)) fail(409, 'meeting.notice-too-short');
    meeting.status = 'INVITED';
    meeting.invitedAt = new Date().toISOString();
    this.changed(meeting, 'INVITED');
    mockServer.events.publish({
      type: 'meetings.meeting-invited',
      data: { meetingId: meeting.id, recipients: this.people.electorate(isAssembly(meeting.kind) ? 'CLUB' : 'BOARD'), kind: meeting.kind,
        title: meeting.title, agenda: meeting.agenda, startsAt: meeting.startsAt, location: meeting.location, videoUrl: meeting.videoUrl },
    });
    return this.dto(viewer, meeting);
  }

  open(viewer: Member, id: string): Meeting {
    const meeting = this.managed(viewer, id);
    if (meeting.status !== 'INVITED') fail(409, 'meeting.not-invited');
    Object.assign(meeting, { status: 'OPEN', openedAt: new Date().toISOString() });
    this.changed(meeting, 'OPENED');
    return this.dto(viewer, meeting);
  }

  close(viewer: Member, id: string, protocol: unknown): Meeting {
    const meeting = this.managed(viewer, id);
    if (meeting.status !== 'OPEN') fail(409, 'meeting.not-open');
    const text = typeof protocol === 'string' ? protocol.trim() || null : null;
    Object.assign(meeting, { status: 'CLOSED', closedAt: new Date().toISOString(), protocol: text ?? meeting.protocol });
    this.changed(meeting, 'CLOSED');
    return this.dto(viewer, meeting);
  }

  setPresence(viewer: Member, id: string, memberId: string, mode: unknown): Meeting {
    const meeting = this.managed(viewer, id);
    if (meeting.status === 'DRAFT') fail(409, 'meeting.not-invited');
    if (meeting.status === 'CLOSED') fail(409, 'meeting.closed');
    if (!this.electorate(meeting.kind).includes(memberId)) fail(400, 'meeting.not-voter');
    if (mode === 'APP' || mode === 'ANALOG') meeting.presence[memberId] = mode;
    else delete meeting.presence[memberId];
    this.changed(meeting, 'PRESENCE');
    return this.dto(viewer, meeting);
  }

  /** server: Meeting record validation */
  private apply(m: StoredMeeting, body: Record<string, any>): void {
    if (body.title !== undefined) m.title = text(body.title, 120, 'meeting.title-invalid') ?? fail(400, 'meeting.title-invalid');
    if (body.agenda !== undefined) m.agenda = text(body.agenda, 4000, 'meeting.agenda-too-long');
    if (body.urgency !== undefined) m.urgency = text(body.urgency, 1000, 'meeting.urgency-invalid');
    if (body.location !== undefined) m.location = text(body.location, 200, 'meeting.location-too-long');
    if (body.videoUrl !== undefined) m.videoUrl = text(body.videoUrl, 500, 'meeting.video-url-invalid');
    if (body.protocol !== undefined) m.protocol = text(body.protocol, 20000, 'meeting.protocol-too-long');
    if (body.startsAt) m.startsAt = new Date(body.startsAt).toISOString();
    if (body.endsAt) m.endsAt = new Date(body.endsAt).toISOString();
    if (!m.startsAt || !m.endsAt || m.endsAt <= m.startsAt) fail(400, 'meeting.times-invalid');
    if (Date.parse(m.endsAt) - Date.parse(m.startsAt) > DAY) fail(400, 'meeting.too-long');
    if (m.videoUrl && !m.videoUrl.startsWith('https://')) fail(400, 'meeting.video-url-invalid');
    if ((m.kind === 'EXTRA_BOARD') !== !!m.urgency) fail(400, 'meeting.urgency-invalid');
    this.meetings.save();
  }

  private electorate(kind: MeetingKind): string[] {
    return this.people.electorate(isAssembly(kind) ? 'ASSEMBLY' : 'BOARD');
  }

  private offices(viewer: Member): OfficeKind[] {
    return this.people.officesOf(viewer.id);
  }

  /** server: MeetingRules.mayConvene */
  private mayConvene(viewer: Member, kind: MeetingKind): boolean {
    if (viewer.roles.includes('ADMIN')) return true;
    const offices = this.offices(viewer);
    const board = offices.some((o) => o !== 'AUDITOR');
    const chair = offices.includes('CHAIR') || offices.includes('VICE_CHAIR');
    return isAssembly(kind) || kind === 'SIMPLE_BOARD' ? board : chair;
  }

  private maySee(viewer: Member, m: StoredMeeting): boolean {
    if (this.people.hasRole(viewer, ADMIN_BOARD)) return true;
    return isAssembly(m.kind) && (!!viewer.membershipType || viewer.honorary);
  }

  private visible(viewer: Member, id: string): StoredMeeting {
    const meeting = this.meetings.data.find((m) => m.id === id);
    return meeting && this.maySee(viewer, meeting) ? meeting : fail(404, 'meeting.not-found');
  }

  private managed(viewer: Member, id: string): StoredMeeting {
    this.people.requirePrivileged(viewer, ADMIN_BOARD);
    const meeting = this.visible(viewer, id);
    if (!this.mayConvene(viewer, meeting.kind) && !this.offices(viewer).includes('SECRETARY')) fail(403, 'access.denied');
    return meeting;
  }

  /** server: MeetingRules.isQuorate */
  private quorate(m: StoredMeeting, voters: string[]): boolean {
    const present = voters.filter((id) => m.presence[id]).length;
    if (!voters.length || !present || (m.status !== 'INVITED' && m.status !== 'OPEN')) return false;
    if (isAssembly(m.kind)) return present * 2 >= voters.length || Date.now() >= Date.parse(m.startsAt) + GRACE;
    if (m.kind === 'EXTRA_BOARD') return present * 4 >= voters.length * 3;
    return present * 2 > voters.length;
  }

  private dto(viewer: Member, m: StoredMeeting): Meeting {
    const { presence, ...rest } = m;
    const voters = this.electorate(m.kind);
    const name = (id: string) => {
      const p = this.people.members.data.find((x) => x.id === id);
      return p ? `${p.firstName} ${p.lastName}` : '–';
    };
    const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
    return {
      ...rest,
      latestInvite: latestInvite(m.kind, m.startsAt),
      electorate: voters.map((id) => ({ memberId: id, name: name(id) })).sort(byName),
      present: Object.entries(presence).map(([id, mode]) => ({ memberId: id, name: name(id), mode })).sort(byName),
      quorate: this.quorate(m, voters),
      canManage: this.mayConvene(viewer, m.kind) || this.offices(viewer).includes('SECRETARY'),
    };
  }

  private changed(m: StoredMeeting, change: string): void {
    this.meetings.save();
    mockServer.events.publish({ type: 'meetings.meeting-changed', data: { meetingId: m.id, change },
      audience: isAssembly(m.kind) ? { everyone: true } : { roles: ADMIN_BOARD } });
  }
}

export const meetings = new MockMeetings(directory);
const actor = (req: MockRequest) => directory.actor(req);

mockServer
  .on('GET', '/api/v1/meetings', (req) => meetings.list(actor(req), req.query.get('from'), req.query.get('to')))
  .on('POST', '/api/v1/meetings', (req) => meetings.create(actor(req), req.body ?? {}))
  .on('GET', '/api/v1/meetings/:id', (req) => meetings.get(actor(req), req.params.id))
  .on('PATCH', '/api/v1/meetings/:id', (req) => meetings.update(actor(req), req.params.id, req.body ?? {}))
  .on('DELETE', '/api/v1/meetings/:id', (req) => meetings.delete(actor(req), req.params.id))
  .on('POST', '/api/v1/meetings/:id/invite', (req) => meetings.invite(actor(req), req.params.id))
  .on('POST', '/api/v1/meetings/:id/open', (req) => meetings.open(actor(req), req.params.id))
  .on('POST', '/api/v1/meetings/:id/close', (req) => meetings.close(actor(req), req.params.id, req.body?.protocol))
  .on('PUT', '/api/v1/meetings/:id/presence/:memberId', (req) => meetings.setPresence(actor(req), req.params.id, req.params.memberId, req.body?.mode));
