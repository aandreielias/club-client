import { describe, expect, it } from 'vitest';
import { directory } from '../../lib/mock/core';
import type { Member } from '../../lib/types';
import { tasks } from './mock';
import { EVERYONE, NO_AUDIENCE } from '../../lib/reach';
import type { NewTask } from './model';

const member = (id: string): Member => directory.members.data.find((m) => m.id === id)!;
const ids = (id: string, mine = false, includeDone = false) => tasks.list(member(id), mine, null, includeDone).map((t) => t.id);

const draft = (teamId: string | null, assignees: string[]): NewTask => ({
  teamId,
  appointmentId: null,
  repeatWeeks: null,
  repeatMonths: null,
  repeatByWeekday: false,
  title: 'Neue Aufgabe',
  description: null,
  dueAt: null,
  assignees,
  checklist: ['Eins', 'Zwei'],
  audience: NO_AUDIENCE,
  priority: 'NORMAL',
  labels: [],
  parentId: null,
  blockedBy: [],
});

describe('mock tasks', () => {
  it('shows tasks to the team, assignees, guardians and managers', () => {
    expect(ids('spieler')).toEqual(['t-3']);
    expect(ids('eltern')).toEqual(['t-3']); // guardian of an assignee
    expect(ids('spielerin', true)).toEqual(['t-1', 't-2']);
    expect(ids('spielerin')).toEqual(['t-1', 't-2', 't-6']); // team tasks too
    expect(ids('vorstand', false, true)).toContain('t-5');
    expect(ids('vorstand')).not.toContain('t-5');
    expect(() => tasks.get(member('spieler'), 't-1')).toThrow(expect.objectContaining({ code: 'task.not-found' }));
  });

  it('lets assignees and team coaches work on a task, not other team members', () => {
    expect(tasks.setStatus(member('spielerin'), 't-1', { status: 'DONE' })).toMatchObject({ status: 'DONE', completedAt: expect.any(String) });
    expect(tasks.setStatus(member('trainer'), 't-1', { status: 'OPEN' })).toMatchObject({ status: 'OPEN', completedAt: null });
    expect(() => tasks.setStatus(member('neu'), 't-1', { status: 'DONE' })).toThrow(expect.objectContaining({ code: 'access.denied' }));
    const item = tasks.get(member('spielerin'), 't-2').checklist[1];
    expect(tasks.check(member('spielerin'), 't-2', item.id, true).checklist[1].done).toBe(true);
  });

  it('allows managing only with the right role and team', () => {
    expect(tasks.create(member('trainer'), draft('t-u16', ['spieler'])).checklist).toHaveLength(2);
    expect(() => tasks.create(member('trainer'), draft('t-u16', ['spielerin']))).toThrow(
      expect.objectContaining({ code: 'task.assignee-not-in-team' }),
    );
    expect(() => tasks.create(member('trainer'), draft(null, ['spieler']))).toThrow(expect.objectContaining({ code: 'access.denied' }));
    expect(() => tasks.delete(member('spielerin'), 't-1')).toThrow(expect.objectContaining({ code: 'access.denied' }));
  });

  it('shows tasks for chosen people to their audience and lets the creating coach manage them', () => {
    const forCoaches = { ...draft(null, ['trainer']), audience: { ...NO_AUDIENCE, roles: ['COACH' as const] } };
    expect(() => tasks.create(member('trainer'), { ...forCoaches, assignees: ['spieler'] })).toThrow(
      expect.objectContaining({ code: 'task.assignee-not-in-audience' }),
    );
    expect(() => tasks.create(member('trainer'), { ...forCoaches, teamId: 't-u16' })).toThrow(
      expect.objectContaining({ code: 'task.audience-invalid' }),
    );
    const created = tasks.create(member('trainer'), forCoaches);
    expect(tasks.audienceMembers(member('trainer'), forCoaches.audience).memberIds).toContain('trainer');
    expect(ids('spieler')).not.toContain(created.id);
    expect(tasks.update(member('trainer'), created.id, { audience: { ...NO_AUDIENCE, memberIds: ['trainer'] } }).audience.memberIds).toEqual([
      'trainer',
    ]);
    expect(() => tasks.update(member('trainer'), created.id, { audience: NO_AUDIENCE })).toThrow(
      expect.objectContaining({ code: 'task.audience-invalid' }),
    );
    expect(() => tasks.audienceMembers(member('spieler'), NO_AUDIENCE)).toThrow(expect.objectContaining({ code: 'access.denied' }));
  });

  it('shows whole-club tasks to every member and lets only the board make them', () => {
    const forAll = { ...draft(null, ['spieler']), audience: EVERYONE };
    expect(() => tasks.create(member('trainer'), forAll)).toThrow(expect.objectContaining({ code: 'access.denied' }));
    expect(() => tasks.create(member('admin'), { ...forAll, audience: { ...EVERYONE, roles: ['COACH' as const] } })).toThrow(
      expect.objectContaining({ code: 'task.audience-invalid' }),
    );
    const created = tasks.create(member('admin'), forAll);
    expect(ids('spielerin')).toContain(created.id);
  });

  it('replaces the checklist on update and keeps omitted fields', () => {
    const updated = tasks.update(member('admin'), 't-2', { checklist: ['Neu'] });
    expect(updated.checklist).toEqual([expect.objectContaining({ text: 'Neu', done: false })]);
    expect(updated.assignees).toEqual(['spielerin', 'neu']);
  });

  it('adds comments for everyone who sees the task', () => {
    const task = tasks.comment(member('neu'), 't-2', 'Ich fahre auch.');
    expect(task.comments.at(-1)).toMatchObject({ authorId: 'neu', text: 'Ich fahre auch.' });
    expect(() => tasks.comment(member('neu'), 't-2', ' ')).toThrow(expect.objectContaining({ code: 'task.comment-invalid' }));
  });

  it('moves tasks between club stages within their phase and keeps each phase staffed', () => {
    const review = tasks.saveStage(member('admin'), null, { label: 'Prüfung', hue: 'purple', phase: 'IN_PROGRESS', sort: 25, archived: false });
    expect(tasks.setStatus(member('spielerin'), 't-1', { stage: review.key })).toMatchObject({ status: 'IN_PROGRESS', stage: review.key });
    expect(tasks.setStatus(member('spielerin'), 't-1', { status: 'IN_PROGRESS' }).stage).toBe(review.key);
    expect(() => tasks.saveStage(member('admin'), review.key, { ...review, phase: 'DONE' })).toThrow(
      expect.objectContaining({ code: 'task-stage.phase-fixed' }),
    );
    expect(() => tasks.deleteStage(member('admin'), review.key)).toThrow(expect.objectContaining({ code: 'task-stage.in-use' }));
    expect(() => tasks.saveStage(member('admin'), 'DONE', { label: 'Erledigt', hue: 'green', phase: 'DONE', sort: 30, archived: true })).toThrow(
      expect.objectContaining({ code: 'task-stage.phase-empty' }),
    );
    expect(() => tasks.saveStage(member('trainer'), null, { label: 'X', hue: 'red', phase: 'OPEN', sort: 1, archived: false })).toThrow(
      expect.objectContaining({ code: 'access.denied' }),
    );
    expect(tasks.setStatus(member('spielerin'), 't-1', { status: 'DONE' }).stage).toBe('DONE');
  });

  it('keeps labels, one level of subtasks and blockers without circles', () => {
    const label = tasks.saveLabel(member('admin'), null, { label: 'Dringend', hue: 'red', sort: 1, archived: false });
    const parent = tasks.create(member('admin'), { ...draft(null, ['spieler']), labels: [label.key] });
    expect(parent.labels).toEqual([label.key]);
    expect(() => tasks.deleteLabel(member('admin'), label.key)).toThrow(expect.objectContaining({ code: 'task-label.in-use' }));
    const child = tasks.create(member('admin'), { ...draft(null, ['spieler']), parentId: parent.id, blockedBy: [parent.id] });
    expect(tasks.get(member('admin'), parent.id).subtasks).toEqual([expect.objectContaining({ id: child.id })]);
    expect(child.blockedBy).toEqual([expect.objectContaining({ id: parent.id })]);
    expect(() => tasks.create(member('admin'), { ...draft(null, ['spieler']), parentId: child.id })).toThrow(
      expect.objectContaining({ code: 'task.parent-invalid' }),
    );
    expect(() => tasks.update(member('admin'), parent.id, { blockedBy: [child.id] })).toThrow(
      expect.objectContaining({ code: 'task.blockers-cycle' }),
    );
    tasks.delete(member('admin'), parent.id);
    expect(tasks.get(member('admin'), child.id)).toMatchObject({ parent: null, blockedBy: [] });
  });
});
