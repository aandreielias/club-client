import { describe, expect, it } from 'vitest';
import { ZonedClock } from '../../lib/time/ZonedClock';
import { MeetingForm } from './MeetingForm.svelte';
import { MeetingTypeForm } from './MeetingTypeForm.svelte';
import { SEEDED_TYPES } from './mockSeeds';
import type { ActionRule, MeetingType } from './model';

const type = (key: string): MeetingType => SEEDED_TYPES.find((t) => t.key === key)!;

describe('MeetingTypeForm', () => {
  it('round-trips a seeded type and keeps whole days in days', () => {
    const assembly = type('ASSEMBLY');
    const form = new MeetingTypeForm(assembly);
    expect(form.noticeUnit).toBe('days');
    expect(form.toInput()).toMatchObject({ label: assembly.label, noticeHours: assembly.noticeHours, dueBy: assembly.dueBy, electorate: 'ASSEMBLY' });
    form.setNoticeHours(30);
    expect([form.notice, form.noticeUnit, form.noticeHours]).toEqual([30, 'hours', 30]);
    form.setNoticeHours(48);
    expect([form.notice, form.noticeUnit]).toEqual([2, 'days']);
  });

  it('checks what the server checks', () => {
    const rules: ActionRule[] = [{ action: 'STATUTES_CHANGE', majority: 'TWO_THIRDS', followUps: [], enabled: true }];
    const form = new MeetingTypeForm(null, rules);
    expect(form.errors).toMatchObject({ label: expect.any(String), invitationLabel: expect.any(String) });
    form.label = 'Klausur';
    form.invitationLabel = 'Klausur';
    expect(form.valid).toBe(true);
    form.actions = ['STATUTES_CHANGE'];
    expect(form.errors.actions).toBe('Sonstige Beschlüsse sind immer möglich.');
    form.actions = ['GENERAL', 'STATUTES_CHANGE'];
    expect(form.errors.majorities).toContain('braucht');
    form.majorities = ['SIMPLE', 'TWO_THIRDS'];
    form.yearly = true;
    [form.dueMonth, form.dueDay] = [2, 30];
    expect(form.errors.dueBy).toBe('Diesen Tag gibt es nicht.');
    [form.dueMonth, form.dueDay] = [2, 28];
    const index = form.addStep('AFTER_END');
    form.steps[index].title = '  ';
    expect(form.errors.steps).toBeDefined();
    form.removeStep(index);
    expect(form.valid).toBe(true);
    expect(form.toInput().dueBy).toBe('02-28');
  });
});

describe('MeetingForm', () => {
  const clock = new ZonedClock('Europe/Vienna');

  it('takes the type name as title until one is typed, and keeps the duration when the start moves', () => {
    const labels = SEEDED_TYPES.map((t) => t.label);
    const form = new MeetingForm(clock, '2026-11-20T18:00', labels);
    form.setType(type('BOARD'));
    expect(form.title).toBe(type('BOARD').label);
    form.setType(type('ASSEMBLY'));
    expect(form.title).toBe(type('ASSEMBLY').label);
    form.title = 'Budget 2027';
    form.setType(type('BOARD'));
    expect(form.title).toBe('Budget 2027');
    form.setStart('2026-11-21T09:00');
    expect(form.end).toBe('2026-11-21T11:00');
    expect(form.toNew()).toMatchObject({ kind: 'BOARD', startsAt: '2026-11-21T08:00:00.000Z', location: null, urgency: null });
  });

  it('needs a reason for urgent types, an end after the start and https video links', () => {
    const form = new MeetingForm(clock, '2026-11-20T18:00');
    form.setType(type('EXTRA_BOARD'));
    expect(form.errors.urgency).toBeDefined();
    form.urgency = 'Halle gekündigt';
    form.end = form.start;
    form.videoUrl = 'http://meet.example';
    expect(Object.keys(form.errors).sort()).toEqual(['end', 'videoUrl']);
  });
});
