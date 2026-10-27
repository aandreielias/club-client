import { describe, expect, it } from 'vitest';
import { settings } from '../../settings';
import { ZonedClock } from '../../lib/time/ZonedClock';
import { AppointmentForm, CLUB_WIDE } from './AppointmentForm.svelte';
import type { Appointment } from './model';

const clock = new ZonedClock('Europe/Vienna');

const existing: Appointment = {
  id: 'a1',
  seriesId: null,
  teamId: 't1',
  type: 'TRAINING',
  title: 'Training',
  description: 'Bälle mitnehmen',
  location: null,
  locationId: null,
  cabinMen: null,
  cabinWomen: null,
  startsAt: '2026-07-01T17:00:00.000Z',
  endsAt: '2026-07-01T18:30:00.000Z',
  cancelled: false,
  rides: false,
};

describe('AppointmentForm', () => {
  it('starts blank with the default time and duration', () => {
    const form = AppointmentForm.blank(clock, null);
    expect(form.teamId).toBe(CLUB_WIDE);
    expect(form.start.slice(11)).toBe(settings.calendar.defaultStartTime);
    expect(Date.parse(`${form.end}Z`) - Date.parse(`${form.start}Z`)).toBe(settings.calendar.defaultDurationMinutes * 60_000);
  });

  it('validates title, times and series limits', () => {
    const form = AppointmentForm.blank(clock, 't1');
    expect(form.errors.title).toBeDefined();
    form.title = 'Training';
    form.end = form.start;
    expect(form.errors.end).toBeDefined();
    form.setStart('2026-07-01T19:00');
    form.end = '2026-07-01T20:00';
    expect(form.valid).toBe(true);

    form.repeat = true;
    form.repeatUntil = '2026-06-01';
    expect(form.errors.repeatUntil).toBeDefined();
    form.repeatUntil = '2030-12-31';
    expect(form.errors.repeatUntil).toContain(String(settings.calendar.maxSeriesOccurrences));
    form.repeatUntil = '2026-07-29';
    expect(form.occurrences()).toBe(5);
    form.intervalWeeks = 2;
    expect(form.occurrences()).toBe(3);
    expect(form.valid).toBe(true);
  });

  it('keeps the duration when the start moves', () => {
    const form = AppointmentForm.edit(clock, existing);
    form.setStart('2026-07-02T10:00');
    expect(form.end).toBe('2026-07-02T11:30');
  });

  it('converts club-local times to UTC instants', () => {
    const form = AppointmentForm.blank(clock, 't1');
    form.title = '  Spiel ';
    form.setStart('2026-01-10T15:00');
    const body = form.toNew();
    expect(body).toMatchObject({ teamId: 't1', title: 'Spiel', startsAt: '2026-01-10T14:00:00.000Z', repeatUntil: null });
  });

  it('patches only changed fields and clears emptied text', () => {
    const form = AppointmentForm.edit(clock, existing);
    expect(form.toPatch()).toEqual({});
    form.title = 'Techniktraining';
    form.description = '';
    expect(form.toPatch()).toEqual({ title: 'Techniktraining', description: '' });
  });

  it('switches between a place and free text and drops cabins for meetings', () => {
    const form = AppointmentForm.edit(clock, { ...existing, location: 'Turnhalle Nord', locationId: 'l-nord', cabinMen: 'Kabine 1' });
    form.locationId = '';
    form.location = 'Beachplatz';
    expect(form.toPatch()).toEqual({ clearLocationId: true, location: 'Beachplatz' });
    form.locationId = 'l-sued';
    expect(form.toPatch()).toEqual({ locationId: 'l-sued' });
    form.type = 'MEETING';
    expect(form.cabinsShown).toBe(false);
    expect(form.toPatch()).toEqual({ locationId: 'l-sued', type: 'MEETING', cabinMen: '' });
  });

  it('offers car pools as the type does until switched', () => {
    const form = AppointmentForm.blank(clock, 't1');
    form.type = 'MATCH';
    expect(form.toNew().rides).toBe(true);
    form.type = 'TRAINING';
    expect(form.toNew().rides).toBe(false);
    form.rides = true;
    form.type = 'MEETING';
    expect(form.toNew().rides).toBe(true);
    expect(AppointmentForm.edit(clock, existing).toPatch()).toEqual({});
    const edited = AppointmentForm.edit(clock, existing);
    edited.rides = true;
    expect(edited.toPatch()).toEqual({ rides: true });
  });
});
