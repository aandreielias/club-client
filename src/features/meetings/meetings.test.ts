import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../../lib/http/ApiClient';
import { directory, MockDirectory } from '../../lib/mock/core';
import { SessionStore } from '../../lib/session/SessionStore.svelte';
import { ZonedClock } from '../../lib/time/ZonedClock';
import type { Member, Role } from '../../lib/types';
import { MeetingForm } from './MeetingForm.svelte';
import { MeetingPolicy } from './MeetingPolicy';
import { MeetingTypeForm } from './MeetingTypeForm.svelte';
import { tasks } from '../tasks/mock';
import { meetings } from './mock';
import { SEEDED_TYPES } from './mockSeeds';
import { latestInvite, type MeetingType } from './model';

const type = (key: string): MeetingType => SEEDED_TYPES.find((t) => t.key === key)!;
const member = (id: string): Member => directory.members.data.find((m) => m.id === id)!;
const DAY = 86_400_000;
const inDays = (days: number) => new Date(Date.now() + days * DAY).toISOString();

function policyFor(roles: Role[]): MeetingPolicy {
  const session = new SessionStore(new ApiClient({ send: vi.fn(), upload: vi.fn(), url: (p) => p }, async () => false));
  session.me = { member: { ...member('spielerin'), roles }, teams: [], missing: [], wardIds: [], wardNames: {} };
  return new MeetingPolicy(session);
}

describe('meeting rules', () => {
  it('mirror the notice periods of the seeded types', () => {
    const start = '2026-12-01T18:00:00.000Z';
    expect(latestInvite(type('ASSEMBLY'), start)).toBe('2026-11-17T18:00:00.000Z');
    expect(latestInvite(type('SIMPLE_BOARD'), start)).toBe('2026-11-24T18:00:00.000Z');
    expect(latestInvite(type('EXTRA_BOARD'), start)).toBe('2026-11-29T18:00:00.000Z');
  });

  it('let the chair convene ordinary board meetings and any board member a simple one', () => {
    const board = policyFor(['BOARD']);
    expect(board.mayConvene(type('BOARD'), ['TREASURER'])).toBe(false);
    expect(board.mayConvene(type('BOARD'), ['VICE_CHAIR', 'SECRETARY'])).toBe(true);
    expect(board.mayConvene(type('SIMPLE_BOARD'), ['TREASURER'])).toBe(true);
    expect(board.mayConvene(type('ASSEMBLY'), ['AUDITOR'])).toBe(false);
    expect(policyFor(['ADMIN']).mayConvene(type('EXTRA_BOARD'), [])).toBe(true);
  });
});

describe('MeetingForm', () => {
  it('follows the type with its title and asks for the urgency where the type needs one', () => {
    const form = new MeetingForm(new ZonedClock('Europe/Vienna'), '2026-12-01T19:00', SEEDED_TYPES.map((t) => t.label));
    expect(form.end).toBe('2026-12-01T21:00');
    form.setType(type('EXTRA_BOARD'));
    expect(form.title).toBe('Außerordentliche Vorstandssitzung');
    expect(Object.keys(form.errors)).toEqual(['urgency']);
    form.urgency = 'Halle gekündigt';
    form.videoUrl = 'http://meet';
    expect(Object.keys(form.errors)).toEqual(['videoUrl']);
    form.videoUrl = '';
    form.title = 'Krisensitzung';
    form.setType(type('SIMPLE_BOARD'));
    expect(form.title).toBe('Krisensitzung'); // typed titles stay
    expect(form.toNew()).toMatchObject({ kind: 'SIMPLE_BOARD', urgency: null, startsAt: '2026-12-01T18:00:00.000Z', endsAt: '2026-12-01T20:00:00.000Z' });
  });
});

describe('mock meetings', () => {
  it('invite within the notice period, take presence and decide the quorum', () => {
    directory.stepUp(member('vorstand'), MockDirectory.PIN);
    const body = (days: number) => ({ kind: 'ASSEMBLY', title: 'MV', startsAt: inDays(days), endsAt: inDays(days + 0.1) });
    const late = meetings.create(member('vorstand'), body(10));
    expect(() => meetings.invite(member('vorstand'), late.id)).toThrow(expect.objectContaining({ code: 'meeting.notice-too-short' }));

    const mv = meetings.create(member('vorstand'), body(20));
    expect(() => meetings.setPresence(member('vorstand'), mv.id, 'admin', 'APP')).toThrow(expect.objectContaining({ code: 'meeting.not-invited' }));
    meetings.invite(member('vorstand'), mv.id);
    // extraordinary and honorary members vote; ordinary ones do not
    const electorate = meetings.get(member('vorstand'), mv.id).electorate.map((p) => p.memberId);
    expect(electorate).toHaveLength(12);
    expect(electorate).toContain('ehren');
    expect(electorate).not.toContain('spielerin');
    expect(() => meetings.setPresence(member('vorstand'), mv.id, 'spielerin', 'APP')).toThrow(expect.objectContaining({ code: 'meeting.not-voter' }));
    for (const id of ['vorstand', 'kassier', 'schrift', 'beisitz', 'beisitz2']) {
      expect(meetings.setPresence(member('vorstand'), mv.id, id, 'APP').quorate).toBe(false);
    }
    expect(meetings.setPresence(member('vorstand'), mv.id, 'trainer', 'ANALOG').quorate).toBe(true); // 6 of 12

    expect(() => meetings.get(member('gast'), mv.id)).toThrow(expect.objectContaining({ code: 'meeting.not-found' }));
    expect(meetings.get(member('helfer'), mv.id).canManage).toBe(false);
    expect(meetings.list(member('helfer'), null, null).items.some((m) => m.kind === 'SIMPLE_BOARD')).toBe(false);
    // ordinary members do not vote, so they neither see nor get invited to general meetings
    expect(() => meetings.get(member('spielerin'), mv.id)).toThrow(expect.objectContaining({ code: 'meeting.not-found' }));
  });
});

describe('mock resolutions', () => {
  it('count app votes and room sums, secret until closed', () => {
    directory.stepUp(member('vorstand'), MockDirectory.PIN);
    const mv = meetings.create(member('vorstand'), { kind: 'ASSEMBLY', title: 'MV', startsAt: inDays(15), endsAt: inDays(15.1) });
    meetings.invite(member('vorstand'), mv.id);
    for (const id of ['vorstand', 'kassier', 'schrift', 'beisitz', 'beisitz2']) meetings.setPresence(member('vorstand'), mv.id, id, 'APP');
    meetings.setPresence(member('vorstand'), mv.id, 'trainer', 'ANALOG');
    const draft = meetings.createResolution(member('vorstand'), mv.id, { title: 'Statutenänderung', majority: 'TWO_THIRDS' });
    expect(() => meetings.openResolution(member('vorstand'), draft.id)).toThrow(expect.objectContaining({ code: 'meeting.not-open' }));
    meetings.open(member('vorstand'), mv.id);
    expect(meetings.openResolution(member('vorstand'), draft.id).analogPresent).toBe(1);

    expect(() => meetings.vote(member('trainer'), draft.id, 'YES')).toThrow(expect.objectContaining({ code: 'resolution.vote-analog' }));
    const voted = meetings.vote(member('vorstand'), draft.id, 'YES');
    expect(voted).toMatchObject({ voted: true, ballots: 1, yes: null });
    expect(() => meetings.vote(member('vorstand'), draft.id, 'NO')).toThrow(expect.objectContaining({ code: 'resolution.already-voted' }));
    expect(() => meetings.analogVotes(member('vorstand'), draft.id, { yes: 1, no: 1, abstain: 0 }))
      .toThrow(expect.objectContaining({ code: 'resolution.analog-exceeds-present' }));
    meetings.analogVotes(member('vorstand'), draft.id, { yes: 0, no: 1, abstain: 0 });
    expect(() => meetings.close(member('vorstand'), mv.id, null)).toThrow(expect.objectContaining({ code: 'meeting.votes-open' }));
    // 1:1 misses two thirds
    expect(meetings.closeResolution(member('vorstand'), draft.id)).toMatchObject({ result: 'FAILED', yes: 1, analogNo: 1 });
  });

  it('run circular votes among the board with written votes', () => {
    directory.stepUp(member('vorstand'), MockDirectory.PIN);
    const soon = meetings.createResolution(member('vorstand'), null, { title: 'Bälle', deadline: inDays(2) });
    expect(() => meetings.openResolution(member('vorstand'), soon.id)).toThrow(expect.objectContaining({ code: 'resolution.deadline-too-short' }));
    const r = meetings.createResolution(member('vorstand'), null, { title: 'Bälle', deadline: inDays(4) });
    const opened = meetings.openResolution(member('vorstand'), r.id);
    expect(opened.voters).toBe(5); // the seeded board
    expect(opened.pending).toHaveLength(5);
    expect(() => meetings.getResolution(member('spielerin'), r.id)).toThrow(expect.objectContaining({ code: 'resolution.not-found' }));
    meetings.vote(member('vorstand'), r.id, 'YES');
    for (const id of ['kassier', 'schrift', 'beisitz']) meetings.recordVote(member('vorstand'), r.id, id, 'NO');
    // the last board member's vote closes it: 2 yes, 3 no
    expect(meetings.recordVote(member('vorstand'), r.id, 'beisitz2', 'YES')).toMatchObject({ status: 'CLOSED', result: 'FAILED', yes: 2 });
  });
});

describe('meeting links', () => {
  it('link records as the manager sees them, never the meeting itself', () => {
    directory.stepUp(member('vorstand'), MockDirectory.PIN);
    const mv = meetings.create(member('vorstand'), { kind: 'ASSEMBLY', title: 'MV', startsAt: inDays(25), endsAt: inDays(25.1) });
    const linked = meetings.setLinks(member('vorstand'), mv.id, [{ kind: 'MEMBER', id: 'kassier' }, { kind: 'MEETING', id: 'mt-past' }]);
    expect(linked.links.map((l) => l.title)).toEqual(['Karin Kassier', 'Ordentliche Vorstandssitzung']);
    expect(() => meetings.setLinks(member('vorstand'), mv.id, [{ kind: 'MEETING', id: mv.id }])).toThrow(expect.objectContaining({ code: 'meeting.ref-unknown' }));
    expect(() => meetings.setLinks(member('vorstand'), mv.id, [{ kind: 'TASK', id: 'nope' }])).toThrow(expect.objectContaining({ code: 'meeting.ref-unknown' }));
    expect(meetings.get(member('helfer'), mv.id).links).toHaveLength(2);
  });
});

describe('invitation document', () => {
  it('is stored in the meeting folder and becomes a new version when generated again', async () => {
    const { files } = await import('../files/mock');
    directory.stepUp(member('vorstand'), MockDirectory.PIN);
    const mv = meetings.create(member('vorstand'), { kind: 'ASSEMBLY', title: 'MV Test', startsAt: inDays(30), endsAt: inDays(30.1) });
    const first = await meetings.generateInvitation(member('vorstand'), mv.id);
    expect(first.links[0]).toMatchObject({ kind: 'FILE', title: expect.stringMatching(/^Einladung .* MV Test\.docx$/) });
    const folder = files.listFolders(member('helfer')).find((f) => f.id === first.links[0].parentId)!;
    expect(files.listFolders(member('helfer')).find((f) => f.id === folder.parentId)).toMatchObject({ name: 'Mitgliederversammlungen', scope: 'ASSEMBLY' });
    expect(files.listFolders(member('spielerin')).some((f) => f.name === 'Mitgliederversammlungen')).toBe(false);

    const templates = files.listFolders(member('vorstand')).find((f) => f.name === 'Vorlagen')!;
    expect(templates.scope).toBe('BOARD');
    expect(files.listFiles(member('vorstand'), templates.id).map((f) => f.name)).toEqual(['Einladung Sitzung.dotx']);
    const { default: JSZip } = await import('jszip');
    const xml = await (await JSZip.loadAsync(files.blob(first.links[0].id)!)).file('word/document.xml')!.async('string');
    expect(xml).toContain('w:w="11906" w:h="16838"'); // A4
    expect(xml).toContain('Einladung zur ordentlichen Mitgliederversammlung');
    expect(xml).toContain('MV Test');
    expect(xml).not.toContain('{{');

    const again = await meetings.generateInvitation(member('vorstand'), mv.id);
    expect(again.links.filter((l) => l.kind === 'FILE')).toHaveLength(1);
    expect(files.listVersions(member('vorstand'), first.links[0].id).items).toHaveLength(2);
  });
});

describe('follow-up tasks', () => {
  it('a passed honorary membership becomes a task that finishes when it is entered', async () => {
    const { tasks } = await import('../tasks/mock');
    directory.stepUp(member('vorstand'), MockDirectory.PIN);
    const mv = meetings.create(member('vorstand'), { kind: 'EXTRA_ASSEMBLY', title: 'aoMV', startsAt: inDays(15), endsAt: inDays(15.1) });
    meetings.invite(member('vorstand'), mv.id);
    for (const id of ['vorstand', 'kassier', 'schrift', 'beisitz', 'beisitz2', 'admin']) meetings.setPresence(member('vorstand'), mv.id, id, 'APP');
    const opened = meetings.open(member('vorstand'), mv.id);
    expect(opened.present.length * 2).toBeGreaterThanOrEqual(opened.electorate.length);
    expect(() => meetings.createResolution(member('vorstand'), mv.id, { title: 'Statuten', majority: 'SIMPLE', action: 'STATUTES_CHANGE' }))
      .toThrow(expect.objectContaining({ code: 'resolution.majority-mismatch' }));
    const r = meetings.createResolution(member('vorstand'), mv.id,
      { title: 'Ehrenmitglied Lena', majority: 'SIMPLE', action: 'HONORARY_GRANT', actionMemberId: 'spielerin', assigneeIds: ['schrift'] });
    meetings.openResolution(member('vorstand'), r.id);
    for (const id of ['vorstand', 'kassier', 'schrift']) meetings.vote(member(id), r.id, 'YES');
    const closed = meetings.closeResolution(member('vorstand'), r.id);
    expect(closed.followUps).toEqual([expect.objectContaining({ kind: 'ENTER_HONORARY', title: 'Ehrenmitgliedschaft eintragen: Lena Spielerin', automatic: true })]);
    const task = tasks.get(member('schrift'), closed.followUps[0].taskId!);
    expect(task).toMatchObject({ assignees: ['schrift'], status: 'OPEN', source: { kind: 'MEETING_FOLLOW_UP' } });

    directory.setMembership(member('vorstand'), 'spielerin', { membershipType: 'ORDINARY', honorary: true });
    expect(tasks.get(member('schrift'), task.id).status).toBe('DONE');

    // Lena votes from the next meeting on: this one keeps the electorate it opened with.
    expect(meetings.get(member('vorstand'), mv.id).electorate.map((p) => p.memberId)).not.toContain('spielerin');
    expect(() => meetings.setPresence(member('vorstand'), mv.id, 'spielerin', 'APP')).toThrow(expect.objectContaining({ code: 'meeting.not-voter' }));
    meetings.setAutoTasks(member('vorstand'), mv.id, false);
    const quiet = meetings.createResolution(member('vorstand'), mv.id, { title: 'Sonstiges', majority: 'SIMPLE' });
    meetings.openResolution(member('vorstand'), quiet.id);
    for (const id of ['vorstand', 'kassier', 'schrift']) meetings.vote(member(id), quiet.id, 'YES');
    expect(meetings.closeResolution(member('vorstand'), quiet.id).followUps).toEqual([]);
    const manual = meetings.addFollowUp(member('vorstand'), { meetingId: mv.id }, { title: 'Protokoll verteilen' });
    expect(manual).toMatchObject({ kind: 'MANUAL', taskId: expect.any(String) });
    // only those present, and for tasks that need admin or board rights only admins and board members
    expect(() => meetings.addFollowUp(member('vorstand'), { meetingId: mv.id }, { title: 'X', assigneeIds: ['spieler'] }))
      .toThrow(expect.objectContaining({ code: 'meeting.assignee-not-allowed' }));
    expect(() => meetings.createResolution(member('vorstand'), mv.id,
      { title: 'Ehrenmitglied', majority: 'SIMPLE', action: 'HONORARY_GRANT', actionMemberId: 'neu', assigneeIds: ['trainer'] }))
      .toThrow(expect.objectContaining({ code: 'meeting.assignee-not-allowed' }));
    const meetingNow = meetings.get(member('vorstand'), mv.id);
    expect(meetingNow.assignable.find((a) => a.memberId === 'admin')).toMatchObject({ manager: true });

    const linked = meetings.setResolutionLinks(member('vorstand'), r.id, [{ kind: 'MEMBER', id: 'spielerin' }, { kind: 'MEETING', id: 'mt-past' }]);
    expect(linked.links.map((l) => l.title)).toEqual(['Lena Spielerin', 'Ordentliche Vorstandssitzung']);
  });
});

describe('meeting types', () => {
  it('edit a seeded type and refuse rules that contradict each other', () => {
    const form = new MeetingTypeForm(type('EXTRA_BOARD'), meetings.rules.data);
    expect([form.notice, form.noticeUnit, form.needsReason]).toEqual([2, 'days', true]);
    form.actions = [...form.actions, 'STATUTES_CHANGE'];
    expect(Object.keys(form.errors)).toEqual(['majorities']);
    form.majorities = ['TWO_THIRDS', 'THREE_QUARTERS'];
    form.yearly = true;
    form.dueDay = 31;
    form.dueMonth = 2;
    expect(Object.keys(form.errors)).toEqual(['dueBy']);
    form.dueDay = 28;
    expect(form.toInput()).toMatchObject({ noticeHours: 48, dueBy: '02-28', needsReason: true });
  });

  it('keep the steps around a meeting: the server reminders plus the club\'s own', () => {
    const form = new MeetingTypeForm(type('ASSEMBLY'));
    expect(form.steps.map((s) => s.system ?? s.anchor)).toEqual(['INVITE_REMINDER', 'START_REMINDER', 'AFTER_END']);
    const i = form.addStep('BEFORE_START');
    form.steps[i].title = ' ';
    expect(Object.keys(form.errors)).toEqual(['steps']);
    form.steps[i].title = 'Saal buchen: {titel}';
    form.setNoticeHours(72);
    expect([form.notice, form.noticeUnit]).toEqual([3, 'days']);
    form.setNoticeHours(30);
    expect([form.notice, form.noticeUnit, form.noticeHours]).toEqual([30, 'hours', 30]);
    expect(form.toInput().steps.at(-1)).toMatchObject({ anchor: 'BEFORE_START', action: 'TASK', title: 'Saal buchen: {titel}', system: null });
  });

  it('are created by the board, used by meetings and then only archived', () => {
    directory.stepUp(member('vorstand'), MockDirectory.PIN);
    expect(() => meetings.saveType(member('spielerin'), null, {})).toThrow();
    const created = meetings.saveType(member('vorstand'), null, { ...new MeetingTypeForm().toInput(), label: 'Klausur', invitationLabel: 'Klausur' });
    expect(created.key).toMatch(/^TYPE_/);
    meetings.create(member('vorstand'), { kind: created.key, title: 'Klausur', startsAt: inDays(20), endsAt: inDays(20.1) });
    expect(meetings.listTypes().items.find((t) => t.key === created.key)?.inUse).toBe(true);
    expect(() => meetings.deleteType(member('vorstand'), created.key)).toThrow();
    expect(created.steps.map((s) => s.system)).toEqual(['INVITE_REMINDER', 'START_REMINDER']);
    expect(() => meetings.saveType(member('vorstand'), created.key, { ...created, steps: [{ ...created.steps[0], action: 'TASK' }] })).toThrow();
    meetings.saveType(member('vorstand'), created.key, { ...created, archived: true });
    expect(() => meetings.create(member('vorstand'), { kind: created.key, title: 'Klausur', startsAt: inDays(21), endsAt: inDays(21.1) })).toThrow();
  });
});

describe('deadlines as tasks', () => {
  it('turn a draft invitation deadline into a board task that follows the meeting and ends with the invitation', () => {
    directory.stepUp(member('vorstand'), MockDirectory.PIN);
    const starts = inDays(30);
    const draft = meetings.create(member('vorstand'), { kind: 'BOARD', title: 'Fristtest', startsAt: starts, endsAt: inDays(30.1) });
    const task = () => tasks.tasks.data.find((t) => t.title === 'Einladen: Fristtest')!;
    expect(task().dueAt).toBe(latestInvite(type('BOARD'), starts));
    const later = inDays(32);
    meetings.update(member('vorstand'), draft.id, { startsAt: later, endsAt: inDays(32.1) });
    expect(task().dueAt).toBe(latestInvite(type('BOARD'), later));
    meetings.invite(member('vorstand'), draft.id);
    expect(task().status).toBe('DONE');
  });
});
