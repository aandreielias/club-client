import { describe, expect, it } from 'vitest';
import { directory, MockDirectory } from '../../lib/mock/core';
import type { Member } from '../../lib/types';
import { tasks } from './mock';
import type { NewTask } from './model';

const member = (id: string): Member => directory.members.data.find((m) => m.id === id)!;
const stepUp = (id: string) => directory.confirm(member(id));
const ids = (id: string, mine = false, includeDone = false) => tasks.list(member(id), mine, null, includeDone).map((t) => t.id);

const draft = (teamId: string | null, assignees: string[]): NewTask => ({
  teamId,
  appointmentId: null,
  repeatWeeks: null,
  title: 'Neue Aufgabe',
  description: null,
  dueAt: null,
  assignees,
  checklist: ['Eins', 'Zwei'],
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
    expect(tasks.setStatus(member('spielerin'), 't-1', 'DONE')).toMatchObject({ status: 'DONE', completedAt: expect.any(String) });
    expect(tasks.setStatus(member('trainer'), 't-1', 'OPEN')).toMatchObject({ status: 'OPEN', completedAt: null });
    expect(() => tasks.setStatus(member('neu'), 't-1', 'DONE')).toThrow(expect.objectContaining({ code: 'access.denied' }));
    const item = tasks.get(member('spielerin'), 't-2').checklist[1];
    expect(tasks.check(member('spielerin'), 't-2', item.id, true).checklist[1].done).toBe(true);
  });

  it('allows managing only with the right role, team and a step-up', () => {
    expect(() => tasks.create(member('trainer'), draft('t-u16', ['spieler']))).toThrow(expect.objectContaining({ code: 'auth.step-up-required' }));
    stepUp('trainer');
    expect(tasks.create(member('trainer'), draft('t-u16', ['spieler'])).checklist).toHaveLength(2);
    expect(() => tasks.create(member('trainer'), draft('t-u16', ['spielerin']))).toThrow(expect.objectContaining({ code: 'task.assignee-not-in-team' }));
    expect(() => tasks.create(member('trainer'), draft(null, ['spieler']))).toThrow(expect.objectContaining({ code: 'access.denied' }));
    expect(() => tasks.delete(member('spielerin'), 't-1')).toThrow(expect.objectContaining({ code: 'access.denied' }));
  });

  it('replaces the checklist on update and keeps omitted fields', () => {
    stepUp('admin');
    const updated = tasks.update(member('admin'), 't-2', { checklist: ['Neu'] });
    expect(updated.checklist).toEqual([expect.objectContaining({ text: 'Neu', done: false })]);
    expect(updated.assignees).toEqual(['spielerin', 'neu']);
  });

  it('adds comments for everyone who sees the task', () => {
    const task = tasks.comment(member('neu'), 't-2', 'Ich fahre auch.');
    expect(task.comments.at(-1)).toMatchObject({ authorId: 'neu', text: 'Ich fahre auch.' });
    expect(() => tasks.comment(member('neu'), 't-2', ' ')).toThrow(expect.objectContaining({ code: 'task.comment-invalid' }));
  });
});
