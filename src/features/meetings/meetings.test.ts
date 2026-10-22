import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../../lib/http/ApiClient';
import { directory, MockDirectory } from '../../lib/mock/core';
import { SessionStore } from '../../lib/session/SessionStore.svelte';
import { ZonedClock } from '../../lib/time/ZonedClock';
import type { Member, Role } from '../../lib/types';
import { MeetingForm } from './MeetingForm.svelte';
import { MeetingPolicy } from './MeetingPolicy';
import { meetings } from './mock';
import { latestInvite } from './model';

const member = (id: string): Member => directory.members.data.find((m) => m.id === id)!;
const DAY = 86_400_000;
const inDays = (days: number) => new Date(Date.now() + days * DAY).toISOString();

function policyFor(roles: Role[]): MeetingPolicy {
  const session = new SessionStore(new ApiClient({ send: vi.fn(), upload: vi.fn(), url: (p) => p }, async () => false));
  session.me = { member: { ...member('spielerin'), roles }, teams: [], missing: [], wardIds: [], wardNames: {} };
  return new MeetingPolicy(session);
}

describe('meeting rules', () => {
  it('mirror the notice periods of the statutes', () => {
    const start = '2026-12-01T18:00:00.000Z';
    expect(latestInvite('ASSEMBLY', start)).toBe('2026-11-17T18:00:00.000Z');
    expect(latestInvite('SIMPLE_BOARD', start)).toBe('2026-11-24T18:00:00.000Z');
    expect(latestInvite('EXTRA_BOARD', start)).toBe('2026-11-29T18:00:00.000Z');
  });

  it('let the chair convene ordinary board meetings and any board member a simple one', () => {
    const board = policyFor(['BOARD']);
    expect(board.mayConvene('BOARD', ['TREASURER'])).toBe(false);
    expect(board.mayConvene('BOARD', ['VICE_CHAIR', 'SECRETARY'])).toBe(true);
    expect(board.mayConvene('SIMPLE_BOARD', ['TREASURER'])).toBe(true);
    expect(board.mayConvene('ASSEMBLY', ['AUDITOR'])).toBe(false);
    expect(policyFor(['ADMIN']).mayConvene('EXTRA_BOARD', [])).toBe(true);
  });
});

describe('MeetingForm', () => {
  it('follows the kind with its title and asks for the urgency of an extraordinary board meeting', () => {
    const form = new MeetingForm(new ZonedClock('Europe/Vienna'), '2026-12-01T19:00');
    expect(form.end).toBe('2026-12-01T21:00');
    form.setKind('EXTRA_BOARD');
    expect(form.title).toBe('Außerordentliche Vorstandssitzung');
    expect(Object.keys(form.errors)).toEqual(['urgency']);
    form.urgency = 'Halle gekündigt';
    form.videoUrl = 'http://meet';
    expect(Object.keys(form.errors)).toEqual(['videoUrl']);
    form.videoUrl = '';
    form.title = 'Krisensitzung';
    form.setKind('SIMPLE_BOARD');
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
    expect(meetings.get(member('spielerin'), mv.id).canManage).toBe(false);
    expect(meetings.list(member('spielerin'), null, null).items.some((m) => m.kind === 'SIMPLE_BOARD')).toBe(false);
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
    expect(meetings.get(member('spielerin'), mv.id).links).toHaveLength(2);
  });
});

describe('invitation document', () => {
  it('is stored in the meeting folder and becomes a new version when generated again', async () => {
    const { files } = await import('../files/mock');
    directory.stepUp(member('vorstand'), MockDirectory.PIN);
    const mv = meetings.create(member('vorstand'), { kind: 'ASSEMBLY', title: 'MV Test', startsAt: inDays(30), endsAt: inDays(30.1) });
    const first = await meetings.generateInvitation(member('vorstand'), mv.id);
    expect(first.links[0]).toMatchObject({ kind: 'FILE', title: expect.stringMatching(/^Einladung .* MV Test\.docx$/) });
    const folder = files.listFolders(member('spielerin')).find((f) => f.id === first.links[0].parentId)!;
    expect(files.listFolders(member('spielerin')).find((f) => f.id === folder.parentId)).toMatchObject({ name: 'Mitgliederversammlungen', scope: 'CLUB' });

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
