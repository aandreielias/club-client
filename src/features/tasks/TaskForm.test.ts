import { describe, expect, it } from 'vitest';
import { settings } from '../../settings';
import { ZonedClock } from '../../lib/time/ZonedClock';
import { BOARD_ONLY, CLUB_WIDE, FOR_CHOSEN, TaskForm } from './TaskForm.svelte';
import { EVERYONE, NO_AUDIENCE } from '../../lib/reach';
import type { Task } from './model';

const clock = new ZonedClock('Europe/Vienna');

const existing: Task = {
  id: 'x1',
  teamId: 't1',
  appointmentId: null,
  title: 'Trikots waschen',
  description: null,
  status: 'OPEN',
  dueAt: '2026-07-01T16:00:00.000Z',
  createdBy: 'm0',
  assignees: ['m1', 'm2'],
  checklist: [
    { id: 'i1', text: 'Abholen', done: true },
    { id: 'i2', text: 'Zurückbringen', done: false },
  ],
  comments: [],
  createdAt: '2026-06-01T10:00:00.000Z',
  completedAt: null,
  repeatWeeks: null,
  repeatMonths: null,
  repeatByWeekday: false,
  source: null,
  audience: NO_AUDIENCE,
};

describe('TaskForm', () => {
  it('requires a title and at least one assignee', () => {
    const form = TaskForm.blank(clock, null, true);
    expect(form.teamId).toBe(CLUB_WIDE);
    expect(Object.keys(form.errors).sort()).toEqual(['assignees', 'title']);
    form.title = 'Halle reservieren';
    form.toggleAssignee('m1');
    expect(form.valid).toBe(true);
    form.toggleAssignee('m1');
    expect(form.errors.assignees).toBeDefined();
  });

  it('builds the create body with club-local due time and trimmed checklist', () => {
    const form = TaskForm.blank(clock, 't1', true);
    expect(form.audience).toEqual(['team:t1']);
    form.title = ' Bälle ';
    form.due = '2026-01-10T18:00';
    form.assignees = ['m1'];
    form.addLine();
    form.addLine();
    form.checklist[0].text = ' Pumpe holen ';
    expect(form.toNew()).toEqual({
      teamId: 't1',
      appointmentId: null,
      title: 'Bälle',
      description: null,
      dueAt: '2026-01-10T17:00:00.000Z',
      assignees: ['m1'],
      checklist: ['Pumpe holen'],
      repeatWeeks: null,
      repeatMonths: null,
      repeatByWeekday: false,
      audience: NO_AUDIENCE,
    });
  });

  it('needs an audience for chosen people and sends it as one record', () => {
    const form = TaskForm.blank(clock, null, false);
    expect(form.teamId).toBe(FOR_CHOSEN);
    form.title = 'Kassa prüfen';
    form.assignees = ['m1'];
    expect(form.errors.audience).toBeDefined();
    form.audience = ['role:COACH', 'office:AUDITOR', 'team:t1', 'kind:HONORARY', 'member:m1'];
    expect(form.valid).toBe(true);
    expect(form.toNew()).toMatchObject({
      teamId: null,
      audience: { roles: ['COACH'], offices: ['AUDITOR'], teamIds: ['t1'], kinds: ['HONORARY'], memberIds: ['m1'] },
    });

    const edit = TaskForm.edit(clock, { ...existing, teamId: null, audience: form.toNew().audience });
    expect(edit.teamId).toBe(FOR_CHOSEN);
    expect(edit.toPatch()).toEqual({});
    edit.audience = ['member:m1'];
    expect(edit.toPatch().audience).toEqual({ ...NO_AUDIENCE, memberIds: ['m1'] });
    edit.teamId = CLUB_WIDE;
    expect(edit.toPatch().audience).toEqual(EVERYONE);
  });

  it('sends the whole club as everyone and keeps board-only club tasks as they are', () => {
    const form = TaskForm.blank(clock, null, true);
    expect(form.toNew()).toMatchObject({ teamId: null, audience: EVERYONE });
    const boardOnly = TaskForm.edit(clock, { ...existing, teamId: null });
    expect(boardOnly.teamId).toBe(BOARD_ONLY);
    expect(boardOnly.toNew().audience).toEqual(NO_AUDIENCE);
  });

  it('caps the checklist length', () => {
    const form = TaskForm.blank(clock, 't1', true);
    for (let i = 0; i < settings.tasks.maxChecklistItems + 5; i++) form.addLine();
    expect(form.checklist).toHaveLength(settings.tasks.maxChecklistItems);
  });

  it('patches only changes and warns before resetting ticks', () => {
    const form = TaskForm.edit(clock, existing);
    expect(form.toPatch()).toEqual({});
    expect(form.resetsTicks).toBe(false);

    form.assignees = ['m2', 'm1'];
    expect(form.toPatch()).toEqual({});

    form.checklist[1].text = 'Zurückbringen bis Montag';
    expect(form.resetsTicks).toBe(true);
    expect(form.toPatch()).toEqual({ checklist: ['Abholen', 'Zurückbringen bis Montag'] });
  });

  it('clears an existing due date', () => {
    const form = TaskForm.edit(clock, existing);
    form.due = '';
    expect(form.valid).toBe(true);
    expect(form.toPatch()).toEqual({ clearDue: true });
  });

  it('drops assignees that are no longer candidates', () => {
    const form = TaskForm.edit(clock, existing);
    form.retainAssignees(['m2', 'm3']);
    expect(form.assignees).toEqual(['m2']);
  });

  it('repeats only with a due date and sends repeat changes', () => {
    const form = TaskForm.blank(clock, 't1', true);
    form.repeat = '2';
    form.submitted = true;
    expect(form.error('repeat')).toBe('Wiederholen geht nur mit Fälligkeit.');
    form.due = '2026-01-10T18:00';
    expect(form.toNew().repeatWeeks).toBe(2);
    form.repeat = 'm1w';
    expect(form.toNew()).toMatchObject({ repeatWeeks: null, repeatMonths: 1, repeatByWeekday: true });
  });
});
