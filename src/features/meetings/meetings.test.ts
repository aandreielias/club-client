import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../../lib/http/ApiClient';
import { directory } from '../../lib/mock/core';
import { SessionStore } from '../../lib/session/SessionStore.svelte';
import { ZonedClock } from '../../lib/time/ZonedClock';
import type { Member, Role } from '../../lib/types';
import { MeetingForm } from './MeetingForm.svelte';
import { MeetingPolicy } from './MeetingPolicy';
import { MeetingTypeForm } from './MeetingTypeForm.svelte';
import { tasks } from '../tasks/mock';
import { meetings } from './mock';
import { mockServer } from '../../lib/mock/MockServer';
import { SEEDED_TYPES } from './mockSeeds';
import { latestInvite, type MeetingType } from './model';

const type = (key: string): MeetingType => SEEDED_TYPES.find((t) => t.key === key)!;
const member = (id: string): Member => directory.members.data.find((m) => m.id === id)!;
const DAY = 86_400_000;
const inDays = (days: number) => new Date(Date.now() + days * DAY).toISOString();

function policyFor(roles: Role[]): MeetingPolicy {
  const session = new SessionStore(new ApiClient({ send: vi.fn(), upload: vi.fn(), url: (p) => p }));
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
    const form = new MeetingForm(
      new ZonedClock('Europe/Vienna'),
      '2026-12-01T19:00',
      SEEDED_TYPES.map((t) => t.label),
    );
    expect(form.end).toBe('2026-12-01T21:00');
    form.setType(type('EXTRA_BOARD'));
    expect(form.title).toBe('Außerordentliche Vorstandssitzung');
    expect(Object.keys(form.errors)).toEqual(['urgency']);
    form.urgency = 'Halle gekündigt';
    form.setType({ ...type('EXTRA_BOARD'), online: true });
    form.videoUrl = 'http://meet';
    expect(Object.keys(form.errors)).toEqual(['videoUrl']);
    form.videoUrl = '';
    form.title = 'Krisensitzung';
    form.setType(type('SIMPLE_BOARD'));
    expect(form.title).toBe('Krisensitzung'); // typed titles stay
    expect(form.toNew()).toMatchObject({
      kind: 'SIMPLE_BOARD',
      urgency: null,
      startsAt: '2026-12-01T18:00:00.000Z',
      endsAt: '2026-12-01T20:00:00.000Z',
    });
  });
});

describe('mock meetings', () => {
  it('invite within the notice period, take presence and decide the quorum', () => {
    const body = (days: number) => ({ kind: 'ASSEMBLY', title: 'MV', startsAt: inDays(days), endsAt: inDays(days + 0.1) });
    const late = meetings.create(member('vorstand'), body(10));
    expect(() => meetings.invite(member('vorstand'), late.id)).toThrow(expect.objectContaining({ code: 'meeting.notice-too-short' }));

    const mv = meetings.create(member('vorstand'), body(20));
    expect(() => meetings.setPresence(member('vorstand'), mv.id, 'admin', true)).toThrow(expect.objectContaining({ code: 'meeting.not-invited' }));
    meetings.invite(member('vorstand'), mv.id);
    // extraordinary and honorary members vote; ordinary ones do not
    const electorate = meetings.get(member('vorstand'), mv.id).electorate.map((p) => p.memberId);
    expect(electorate).toHaveLength(12);
    expect(electorate).toContain('ehren');
    expect(electorate).not.toContain('spielerin');
    expect(() => meetings.setPresence(member('vorstand'), mv.id, 'spielerin', true)).toThrow(expect.objectContaining({ code: 'meeting.not-voter' }));
    for (const id of ['vorstand', 'kassier', 'schrift', 'beisitz', 'beisitz2']) {
      expect(meetings.setPresence(member('vorstand'), mv.id, id, true).quorate).toBe(false);
    }
    expect(meetings.setPresence(member('vorstand'), mv.id, 'trainer', true).quorate).toBe(true); // 6 of 12

    expect(() => meetings.get(member('gast'), mv.id)).toThrow(expect.objectContaining({ code: 'meeting.not-found' }));
    expect(meetings.get(member('helfer'), mv.id).canManage).toBe(false);
    expect(meetings.list(member('helfer'), null, null).items.some((m) => m.kind === 'SIMPLE_BOARD')).toBe(false);
    // ordinary members do not vote, so they neither see nor get invited to general meetings
    expect(() => meetings.get(member('spielerin'), mv.id)).toThrow(expect.objectContaining({ code: 'meeting.not-found' }));
  });
});

describe('mock resolutions', () => {
  it('added to an invited meeting follow the agenda rules: change notice, 50 items at most', () => {
    const mv = meetings.create(member('vorstand'), { kind: 'ASSEMBLY', title: 'MV', startsAt: inDays(15), endsAt: inDays(15.1) });
    meetings.invite(member('vorstand'), mv.id);
    const notices: Record<string, any>[] = [];
    const stop = mockServer.events.subscribe((e) => e.type === 'meetings.meeting-notice' && notices.push(e.data as Record<string, any>));
    meetings.createResolution(member('vorstand'), mv.id, { title: 'Neue Netze' });
    stop();
    expect(notices).toEqual([expect.objectContaining({ title: 'Geändert: MV', body: 'Geändert: Tagesordnung.' })]);

    const stored = meetings.meetings.data.find((m) => m.id === mv.id)!;
    stored.agendaItems = Array.from({ length: 50 }, (_, k) => ({ id: `i${k}`, title: `Punkt ${k}`, note: null, resolutionId: null }));
    expect(() => meetings.createResolution(member('vorstand'), mv.id, { title: 'Zu viel' })).toThrow(
      expect.objectContaining({ code: 'meeting.agenda-invalid' }),
    );
  });

  it('vote secretly in the app, only those present, secret until closed', () => {
    const mv = meetings.create(member('vorstand'), { kind: 'ASSEMBLY', title: 'MV', startsAt: inDays(15), endsAt: inDays(15.1) });
    meetings.invite(member('vorstand'), mv.id);
    for (const id of ['vorstand', 'kassier', 'schrift', 'beisitz', 'beisitz2', 'trainer']) meetings.setPresence(member('vorstand'), mv.id, id, true);
    const draft = meetings.createResolution(member('vorstand'), mv.id, { title: 'Statutenänderung', majority: 'TWO_THIRDS' });
    expect(() => meetings.openResolution(member('vorstand'), draft.id, 'APP')).toThrow(
      expect.objectContaining({ code: 'resolution.meeting-not-open' }),
    );
    meetings.open(member('vorstand'), mv.id);
    expect(() => meetings.openResolution(member('vorstand'), draft.id)).toThrow(expect.objectContaining({ code: 'resolution.vote-mode-missing' }));
    expect(meetings.openResolution(member('vorstand'), draft.id, 'APP')).toMatchObject({ voteMode: 'APP', presentVoters: 6 });

    expect(() => meetings.vote(member('ehren'), draft.id, 'YES')).toThrow(expect.objectContaining({ code: 'resolution.not-present' }));
    const voted = meetings.vote(member('vorstand'), draft.id, 'YES');
    expect(voted).toMatchObject({ voted: true, ballots: 1, yes: null });
    expect(() => meetings.vote(member('vorstand'), draft.id, 'NO')).toThrow(expect.objectContaining({ code: 'resolution.already-voted' }));
    expect(() => meetings.analogVotes(member('vorstand'), draft.id, { yes: 1, no: 0, abstain: 0 })).toThrow(
      expect.objectContaining({ code: 'resolution.vote-in-app' }),
    );
    meetings.vote(member('kassier'), draft.id, 'NO');
    expect(() => meetings.close(member('vorstand'), mv.id, null)).toThrow(expect.objectContaining({ code: 'meeting.votes-open' }));
    // 1:1 misses two thirds
    expect(meetings.closeResolution(member('vorstand'), draft.id)).toMatchObject({ result: 'FAILED', yes: 1, no: 1 });
  });

  it('pick Vorsitz and Schriftführung among those present; they approve the protocol', () => {
    const mv = meetings.create(member('vorstand'), { kind: 'SIMPLE_BOARD', title: 'VS', startsAt: inDays(15), endsAt: inDays(15.1) });
    expect(() => meetings.setRoles(member('vorstand'), mv.id, { chairId: 'vorstand' })).toThrow(
      expect.objectContaining({ code: 'meeting.roles-fixed' }),
    );
    meetings.invite(member('vorstand'), mv.id);
    for (const id of ['vorstand', 'kassier', 'schrift']) meetings.setPresence(member('vorstand'), mv.id, id, true);
    expect(() => meetings.setRoles(member('vorstand'), mv.id, { chairId: 'beisitz' })).toThrow(
      expect.objectContaining({ code: 'meeting.role-not-present' }),
    );
    expect(() => meetings.setRoles(member('vorstand'), mv.id, { chairId: 'kassier', secretaryId: 'kassier' })).toThrow(
      expect.objectContaining({ code: 'meeting.roles-same' }),
    );
    const picked = meetings.setRoles(member('vorstand'), mv.id, { chairId: 'kassier', secretaryId: 'schrift' });
    expect(picked).toMatchObject({ chair: { memberId: 'kassier' }, secretary: { memberId: 'schrift' } });
    // leaving the presence gives up the role
    expect(meetings.setPresence(member('vorstand'), mv.id, 'schrift', false).secretary).toBeNull();
    meetings.setPresence(member('vorstand'), mv.id, 'schrift', true);
    meetings.setRoles(member('vorstand'), mv.id, { chairId: 'kassier', secretaryId: 'schrift' });
    meetings.open(member('vorstand'), mv.id);
    meetings.close(member('vorstand'), mv.id, 'Alles erledigt.');
    meetings.finalizeProtocol(member('vorstand'), mv.id);
    expect(() => meetings.approveProtocol(member('vorstand'), mv.id)).toThrow(expect.objectContaining({ code: 'meeting.approve-not-allowed' }));
    expect(meetings.approveProtocol(member('kassier'), mv.id).approvals[0]).toMatchObject({ memberId: 'kassier', office: 'CHAIR' });
  });

  it('let the picked Vorsitz run the meeting, also without a board office', () => {
    const mv = meetings.create(member('vorstand'), { kind: 'ASSEMBLY', title: 'MV', startsAt: inDays(20), endsAt: inDays(20.1) });
    meetings.invite(member('vorstand'), mv.id);
    for (const id of ['vorstand', 'kassier', 'schrift', 'beisitz', 'beisitz2', 'trainer']) meetings.setPresence(member('vorstand'), mv.id, id, true);
    expect(meetings.get(member('trainer'), mv.id).canManage).toBe(false);
    expect(() => meetings.open(member('trainer'), mv.id)).toThrow(expect.objectContaining({ code: 'access.denied' }));
    meetings.setRoles(member('vorstand'), mv.id, { chairId: 'trainer' });
    expect(meetings.get(member('trainer'), mv.id).canManage).toBe(true);
    meetings.open(member('trainer'), mv.id);
    const r = meetings.createResolution(member('trainer'), mv.id, { title: 'Spontan' });
    meetings.openResolution(member('trainer'), r.id, 'HAND');
    expect(meetings.analogVotes(member('trainer'), r.id, { yes: 6, no: 0, abstain: 0 }, true).result).toBe('PASSED');
  });

  it('vote by show of hands: counts at most those present, "Einstimmig" closes at once', () => {
    const mv = meetings.create(member('vorstand'), { kind: 'SIMPLE_BOARD', title: 'VS', startsAt: inDays(15), endsAt: inDays(15.1) });
    meetings.invite(member('vorstand'), mv.id);
    for (const id of ['vorstand', 'kassier', 'schrift']) meetings.setPresence(member('vorstand'), mv.id, id, true);
    meetings.open(member('vorstand'), mv.id);
    const draft = meetings.createResolution(member('vorstand'), mv.id, { title: 'Netze' });
    meetings.openResolution(member('vorstand'), draft.id, 'HAND');
    expect(() => meetings.vote(member('kassier'), draft.id, 'YES')).toThrow(expect.objectContaining({ code: 'resolution.vote-by-hand' }));
    expect(() => meetings.closeResolution(member('vorstand'), draft.id)).toThrow(expect.objectContaining({ code: 'resolution.analog-missing' }));
    expect(() => meetings.analogVotes(member('vorstand'), draft.id, { yes: 4, no: 0, abstain: 0 })).toThrow(
      expect.objectContaining({ code: 'resolution.analog-exceeds-present' }),
    );
    expect(() => meetings.setPresence(member('vorstand'), mv.id, 'beisitz', true)).toThrow(expect.objectContaining({ code: 'meeting.vote-open' }));
    const closed = meetings.analogVotes(member('vorstand'), draft.id, { yes: 3, no: 0, abstain: 0 }, true);
    expect(closed).toMatchObject({ status: 'CLOSED', result: 'PASSED', voteMode: 'HAND', analogYes: 3 });
  });

  it('run circular votes among the board with written votes', () => {
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
    const mv = meetings.create(member('vorstand'), { kind: 'ASSEMBLY', title: 'MV', startsAt: inDays(25), endsAt: inDays(25.1) });
    const linked = meetings.setLinks(member('vorstand'), mv.id, [
      { kind: 'MEMBER', id: 'kassier' },
      { kind: 'MEETING', id: 'mt-past' },
    ]);
    expect(linked.links.map((l) => l.title)).toEqual(['Karin Kassier', 'Ordentliche Vorstandssitzung']);
    expect(() => meetings.setLinks(member('vorstand'), mv.id, [{ kind: 'MEETING', id: mv.id }])).toThrow(
      expect.objectContaining({ code: 'meeting.ref-unknown' }),
    );
    expect(() => meetings.setLinks(member('vorstand'), mv.id, [{ kind: 'TASK', id: 'nope' }])).toThrow(
      expect.objectContaining({ code: 'meeting.ref-unknown' }),
    );
    // voters see a general meeting from its invitation on
    expect(() => meetings.get(member('helfer'), mv.id)).toThrow(expect.objectContaining({ code: 'meeting.not-found' }));
    meetings.invite(member('vorstand'), mv.id);
    expect(meetings.get(member('helfer'), mv.id).links).toHaveLength(2);
  });
});

describe('invitation document', () => {
  it('is stored in the meeting folder and becomes a new version when generated again', async () => {
    const { files } = await import('../files/mock');
    const mv = meetings.create(member('vorstand'), { kind: 'ASSEMBLY', title: 'MV Test', startsAt: inDays(30), endsAt: inDays(30.1) });
    const first = await meetings.generateInvitation(member('vorstand'), mv.id);
    expect(first.links[0]).toMatchObject({ kind: 'FILE', title: expect.stringMatching(/^Einladung .* MV Test\.docx$/) });
    const folder = files.listFolders(member('helfer')).find((f) => f.id === first.links[0].parentId)!;
    expect(files.listFolders(member('helfer')).find((f) => f.id === folder.parentId)).toMatchObject({
      name: 'Mitgliederversammlungen',
      scope: 'ASSEMBLY',
    });
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

describe('Beschlüsse and their tasks', () => {
  it('are entered with the meeting, show in the invitation and become one task once passed', () => {
    const invited: Record<string, any>[] = [];
    const stop = mockServer.events.subscribe((e) => e.type === 'meetings.meeting-invited' && invited.push(e.data as Record<string, any>));
    const mv = meetings.create(member('vorstand'), {
      kind: 'EXTRA_ASSEMBLY',
      title: 'aoMV',
      startsAt: inDays(15),
      endsAt: inDays(15.1),
      items: [
        { title: 'Begrüßung' },
        { title: 'Ehrenmitglied Lena', motion: { text: 'Lena wird Ehrenmitglied.', assigneeIds: ['schrift'], implementDue: '2030-01-31' } },
        { title: 'Beitrag', motion: { text: 'Plus 10 €.', majority: 'TWO_THIRDS' } },
      ],
    });
    expect(mv.agenda).toBe('1. Begrüßung\n2. Ehrenmitglied Lena\n3. Beitrag');
    const [lena, beitrag] = [mv.agendaItems[1].resolutionId!, mv.agendaItems[2].resolutionId!];
    expect(meetings.getResolution(member('vorstand'), lena)).toMatchObject({
      majority: 'SIMPLE',
      implementDue: '2030-01-31',
      assignees: [{ memberId: 'schrift' }],
    });
    expect(meetings.getResolution(member('vorstand'), beitrag).majority).toBe('TWO_THIRDS');

    meetings.invite(member('vorstand'), mv.id);
    stop();
    expect(invited[0].items).toEqual([
      { title: 'Begrüßung', resolution: false, motion: null },
      { title: 'Ehrenmitglied Lena', resolution: true, motion: 'Lena wird Ehrenmitglied.' },
      { title: 'Beitrag', resolution: true, motion: 'Plus 10 €.' },
    ]);

    for (const id of ['vorstand', 'kassier', 'schrift', 'beisitz', 'beisitz2', 'admin']) meetings.setPresence(member('vorstand'), mv.id, id, true);
    meetings.open(member('vorstand'), mv.id);
    for (const r of [lena, beitrag]) {
      meetings.openResolution(member('vorstand'), r, 'APP');
      for (const id of ['vorstand', 'kassier', 'schrift']) meetings.vote(member(id), r, r === lena || id === 'vorstand' ? 'YES' : 'NO');
    }
    const passed = meetings.closeResolution(member('vorstand'), lena);
    const failed = meetings.closeResolution(member('vorstand'), beitrag);
    expect(failed).toMatchObject({ result: 'FAILED', taskId: null });
    const task = tasks.get(member('schrift'), passed.taskId!);
    expect(task).toMatchObject({ title: 'Ehrenmitglied Lena umsetzen', assignees: ['schrift'], source: { kind: 'RESOLUTION', id: lena } });
    expect(task.description).toContain('Lena wird Ehrenmitglied.');

    // a voted Beschluss stays on the agenda; Lena votes from the next meeting on
    expect(() => meetings.setAgenda(member('vorstand'), mv.id, [{ title: 'Nur das' }])).toThrow(
      expect.objectContaining({ code: 'meeting.agenda-motion-voted' }),
    );
    expect(() => meetings.setPresence(member('vorstand'), mv.id, 'spielerin', true)).toThrow(expect.objectContaining({ code: 'meeting.not-voter' }));

    const linked = meetings.setResolutionLinks(member('vorstand'), lena, [
      { kind: 'MEMBER', id: 'spielerin' },
      { kind: 'MEETING', id: 'mt-past' },
    ]);
    expect(linked.links.map((l) => l.title)).toEqual(['Lena Spielerin', 'Ordentliche Vorstandssitzung']);
  });

  it('change drafts with the agenda, and add a Beschluss during the meeting as the last item', () => {
    const mv = meetings.create(member('vorstand'), {
      kind: 'SIMPLE_BOARD',
      title: 'VS',
      startsAt: inDays(15),
      endsAt: inDays(15.1),
      items: [
        { title: 'Bälle', motion: { text: '10 Bälle.' } },
        { title: 'Weg', motion: { text: 'x' } },
      ],
    });
    const [balls, gone] = [mv.agendaItems[0].resolutionId!, mv.agendaItems[1].resolutionId!];
    const changed = meetings.setAgenda(member('vorstand'), mv.id, [
      { id: mv.agendaItems[0].id, title: 'Bälle und Netze', resolutionId: balls, motion: { text: '10 Bälle, 2 Netze.', assigneeIds: ['kassier'] } },
    ]);
    expect(changed.agendaItems).toHaveLength(1);
    expect(() => meetings.getResolution(member('vorstand'), gone)).toThrow(expect.objectContaining({ status: 404 }));
    expect(meetings.getResolution(member('vorstand'), balls)).toMatchObject({ title: 'Bälle und Netze', text: '10 Bälle, 2 Netze.' });
    expect(() => meetings.createResolution(member('vorstand'), mv.id, { title: 'x', assigneeIds: ['nobody'] })).toThrow(
      expect.objectContaining({ code: 'meeting.assignee-unknown' }),
    );
    const added = meetings.createResolution(member('vorstand'), mv.id, { title: 'Spontan' });
    expect(meetings.get(member('vorstand'), mv.id).agendaItems.at(-1)).toMatchObject({ title: 'Spontan', resolutionId: added.id });
    meetings.deleteResolution(member('vorstand'), added.id);
    expect(meetings.get(member('vorstand'), mv.id).agendaItems).toHaveLength(1);
  });
});

describe('meeting types', () => {
  it('edit a seeded type and refuse rules that contradict each other', () => {
    const form = new MeetingTypeForm(type('EXTRA_BOARD'));
    expect([form.notice, form.noticeUnit, form.needsReason]).toEqual([2, 'days', true]);
    form.majorities = [];
    expect(Object.keys(form.errors)).toEqual(['majorities']);
    form.majorities = ['TWO_THIRDS', 'THREE_QUARTERS'];
    form.yearly = true;
    form.dueDay = 31;
    form.dueMonth = 2;
    expect(Object.keys(form.errors)).toEqual(['dueBy']);
    form.dueDay = 28;
    expect(form.toInput()).toMatchObject({ noticeHours: 48, dueBy: '02-28', needsReason: true });
  });

  it("keep the steps around a meeting: the server reminders plus the club's own", () => {
    const form = new MeetingTypeForm(type('ASSEMBLY'));
    expect(form.steps.map((s) => s.system ?? s.anchor)).toEqual(['INVITE_REMINDER', 'START_REMINDER', 'AFTER_END']);
    const i = form.steps.push(form.newStep('BEFORE_START')) - 1;
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
    const starts = inDays(30);
    const draft = meetings.create(member('vorstand'), { kind: 'BOARD', title: 'Fristtest', startsAt: starts, endsAt: inDays(30.1) });
    const task = () => tasks.tasks.data.find((t) => t.title === 'Einladen: Fristtest')!;
    expect(task().dueAt).toBe(latestInvite(type('BOARD'), starts));
    const later = inDays(32);
    meetings.update(member('vorstand'), draft.id, { startsAt: later, endsAt: inDays(32.1) });
    expect(task().dueAt).toBe(latestInvite(type('BOARD'), later));
    meetings.invite(member('vorstand'), draft.id);
    expect(task().status).toBe('DONE');

    const gone = meetings.create(member('vorstand'), { kind: 'BOARD', title: 'Fristweg', startsAt: starts, endsAt: inDays(30.1) });
    expect(tasks.tasks.data.some((t) => t.title === 'Einladen: Fristweg')).toBe(true);
    meetings.delete(member('vorstand'), gone.id);
    expect(tasks.tasks.data.some((t) => t.title === 'Einladen: Fristweg')).toBe(false);
  });
});

describe('mock online meetings', () => {
  it('shows the link of online kinds; who joins by video is Anwesend and votes in the app', () => {
    const mv = meetings.create(member('vorstand'), { kind: 'ASSEMBLY', title: 'MV', startsAt: inDays(16), endsAt: inDays(16.1) });
    expect(mv).toMatchObject({ online: false, videoUrl: null });
    meetings.invite(member('vorstand'), mv.id);
    // The kind turns online with a standing link: its meetings show it.
    const assembly = meetings.types.data.find((t) => t.key === 'ASSEMBLY')!;
    Object.assign(assembly, { online: true, videoUrl: 'https://meet.example/mv' });
    try {
      const online = meetings.get(member('vorstand'), mv.id);
      expect(online).toMatchObject({ online: true, videoUrl: 'https://meet.example/mv' });
      expect(meetings.update(member('vorstand'), mv.id, { videoUrl: 'https://meet.example/heute' }).videoUrl).toBe('https://meet.example/heute');
      meetings.setPresence(member('vorstand'), mv.id, 'kassier', true);
      for (const p of online.electorate.filter((e) => e.memberId !== 'kassier')) meetings.setPresence(member('vorstand'), mv.id, p.memberId, true);
      meetings.open(member('vorstand'), mv.id);
      const draft = meetings.createResolution(member('vorstand'), mv.id, { title: 'Online', majority: 'SIMPLE' });
      meetings.openResolution(member('vorstand'), draft.id, 'APP');
      expect(meetings.vote(member('kassier'), draft.id, 'YES')).toMatchObject({ voted: true });
      // Without a standing link each meeting needs its own.
      assembly.videoUrl = null;
      expect(() => meetings.create(member('vorstand'), { kind: 'ASSEMBLY', title: 'MV', startsAt: inDays(17), endsAt: inDays(17.1) })).toThrow(
        expect.objectContaining({ code: 'meeting.video-missing' }),
      );
    } finally {
      Object.assign(assembly, { online: false, videoUrl: null });
    }
  });
});
