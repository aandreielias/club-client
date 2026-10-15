import { describe, expect, it } from 'vitest';
import { directory, MockDirectory } from '../../lib/mock/core';
import type { Member } from '../../lib/types';
import { calendar } from './mock';
import type { NewAppointment } from './model';

const member = (id: string): Member => directory.members.data.find((m) => m.id === id)!;
const stepUp = (id: string) => directory.stepUp(member(id), MockDirectory.PIN);
const range = (days: number) => [new Date(Date.now() - 8 * 86_400_000).toISOString(), new Date(Date.now() + days * 86_400_000).toISOString()];

const draft = (teamId: string | null, extra: Partial<NewAppointment> = {}): NewAppointment => ({
  teamId,
  type: 'TRAINING',
  title: 'Zusatztraining',
  description: null,
  location: null,
  startsAt: '2027-01-12T18:00:00.000Z',
  endsAt: '2027-01-12T19:30:00.000Z',
  repeatUntil: null,
  intervalWeeks: null,
  ...extra,
});

describe('mock calendar', () => {
  it('shows team appointments only to the team, wards’ guardians and managers', () => {
    const [from, to] = range(40);
    const teamsSeen = (id: string) => new Set(calendar.list(member(id), from, to, null).map((a) => a.teamId));
    expect(teamsSeen('spieler')).toEqual(new Set(['t-u16', null]));
    expect(teamsSeen('eltern')).toEqual(new Set(['t-u16', null]));
    expect(teamsSeen('admin')).toEqual(new Set(['t-damen', 't-u16', null]));
    const damen = calendar.list(member('admin'), from, to, 't-damen')[0];
    expect(() => calendar.visible(member('spieler'), damen.id)).toThrow(expect.objectContaining({ status: 404 }));
  });

  it('rejects ranges over the limit', () => {
    expect(() => calendar.list(member('admin'), '2026-01-01T00:00:00Z', '2027-06-01T00:00:00Z', null)).toThrow(
      expect.objectContaining({ code: 'calendar.range-invalid' }),
    );
  });

  it('lets coaches plan their teams after a step-up, and only managers plan club-wide', () => {
    expect(() => calendar.create(member('trainer'), draft('t-u16'))).toThrow(expect.objectContaining({ code: 'auth.step-up-required' }));
    stepUp('trainer');
    expect(calendar.create(member('trainer'), draft('t-u16'))).toHaveLength(1);
    expect(() => calendar.create(member('trainer'), draft(null))).toThrow(expect.objectContaining({ code: 'access.denied' }));
    expect(() => calendar.create(member('spielerin'), draft('t-damen'))).toThrow(expect.objectContaining({ code: 'access.denied' }));
  });

  it('creates weekly series at the same club-local time across DST', () => {
    stepUp('vorstand');
    const series = calendar.create(member('vorstand'), draft(null, {
      startsAt: '2027-03-23T17:00:00.000Z', // 18:00 Vienna (CET)
      endsAt: '2027-03-23T18:00:00.000Z',
      repeatUntil: '2027-04-06',
      intervalWeeks: 1,
    }));
    expect(series.map((a) => directory.clock.toLocal(a.startsAt))).toEqual(['2027-03-23T18:00', '2027-03-30T18:00', '2027-04-06T18:00']);
    expect(new Set(series.map((a) => a.seriesId)).size).toBe(1);

    expect(calendar.cancel(member('vorstand'), series[1].id, true).map((a) => a.id)).toEqual([series[1].id, series[2].id]);
  });

  it('applies the answer rules', () => {
    stepUp('admin');
    const [past] = calendar.create(member('admin'), draft('t-damen', {
      startsAt: '2020-01-01T10:00:00.000Z',
      endsAt: '2020-01-01T11:00:00.000Z',
    }));
    const [open] = calendar.create(member('admin'), draft('t-damen'));
    expect(() => calendar.respond(member('spielerin'), past.id, { status: 'YES' })).toThrow(expect.objectContaining({ code: 'attendance.closed' }));
    expect(() => calendar.respond(member('admin'), open.id, { status: 'YES' })).toThrow(expect.objectContaining({ code: 'attendance.not-in-team' }));

    calendar.respond(member('spielerin'), open.id, { status: 'NO', reason: 'Krank' });
    const coachView = calendar.overview(member('trainer'), open.id);
    expect(coachView).toMatchObject({ no: 1 });
    expect(coachView.entries.find((e) => e.memberId === 'spielerin')?.reason).toBe('Krank');
    expect(calendar.overview(member('neu'), open.id).entries.find((e) => e.memberId === 'spielerin')?.reason).toBeNull();
  });
});
