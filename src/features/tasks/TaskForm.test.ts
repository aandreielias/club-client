import { describe, expect, it } from 'vitest';
import { settings } from '../../settings';
import { ZonedClock } from '../../lib/time/ZonedClock';
import { CLUB_WIDE, TaskForm } from './TaskForm.svelte';
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
};

describe('TaskForm', () => {
  it('requires a title and at least one assignee', () => {
    const form = TaskForm.blank(clock, null);
    expect(form.teamId).toBe(CLUB_WIDE);
    expect(Object.keys(form.errors).sort()).toEqual(['assignees', 'title']);
    form.title = 'Halle reservieren';
    form.toggleAssignee('m1');
    expect(form.valid).toBe(true);
    form.toggleAssignee('m1');
    expect(form.errors.assignees).toBeDefined();
  });

  it('builds the create body with club-local due time and trimmed checklist', () => {
    const form = TaskForm.blank(clock, 't1');
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
    });
  });

  it('caps the checklist length', () => {
    const form = TaskForm.blank(clock, 't1');
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
});
