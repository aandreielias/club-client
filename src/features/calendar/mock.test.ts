import { describe, expect, it } from 'vitest';
import { directory } from '../../lib/mock/core';
import type { Member } from '../../lib/types';
import { calendar } from './mock';
import type { NewAppointment } from './model';

const RULES = {
  defaultStart: '18:00',
  defaultMinutes: 90,
  maxDays: 7,
  answerDeadlineHours: 0,
  allowMaybe: true,
  reasonOnNo: false,
  expectAnswers: 'TEAM',
  notifyChanges: true,
  minShiftMinutes: 0,
  selfCheckIn: false,
  remindAgainHours: null,
} as const;
const member = (id: string): Member => directory.members.data.find((m) => m.id === id)!;
const range = (days: number) => [new Date(Date.now() - 8 * 86_400_000).toISOString(), new Date(Date.now() + days * 86_400_000).toISOString()];

const draft = (teamId: string | null, extra: Partial<NewAppointment> = {}): NewAppointment => ({
  teamId,
  type: 'TRAINING',
  title: 'Zusatztraining',
  description: null,
  location: null,
  locationId: null,
  cabins: [],
  startsAt: '2027-01-12T18:00:00.000Z',
  endsAt: '2027-01-12T19:30:00.000Z',
  repeatUntil: null,
  intervalWeeks: null,
  intervalMonths: null,
  byWeekday: false,
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

  it('lets coaches plan their teams, and only managers plan club-wide', () => {
    expect(calendar.create(member('trainer'), draft('t-u16'))).toHaveLength(1);
    expect(() => calendar.create(member('trainer'), draft(null))).toThrow(expect.objectContaining({ code: 'access.denied' }));
    expect(() => calendar.create(member('spielerin'), draft('t-damen'))).toThrow(expect.objectContaining({ code: 'access.denied' }));
  });

  it('creates weekly series at the same club-local time across DST', () => {
    const series = calendar.create(
      member('vorstand'),
      draft(null, {
        startsAt: '2027-03-23T17:00:00.000Z', // 18:00 Vienna (CET)
        endsAt: '2027-03-23T18:00:00.000Z',
        repeatUntil: '2027-04-06',
        intervalWeeks: 1,
        intervalMonths: null,
        byWeekday: false,
      }),
    );
    expect(series.map((a) => directory.clock.toLocal(a.startsAt))).toEqual(['2027-03-23T18:00', '2027-03-30T18:00', '2027-04-06T18:00']);
    expect(new Set(series.map((a) => a.seriesId)).size).toBe(1);

    expect(calendar.cancel(member('vorstand'), series[1].id, true).map((a) => a.id)).toEqual([series[1].id, series[2].id]);
  });

  it('applies the answer rules', () => {
    const [past] = calendar.create(
      member('admin'),
      draft('t-damen', {
        startsAt: '2020-01-01T10:00:00.000Z',
        endsAt: '2020-01-01T11:00:00.000Z',
      }),
    );
    const [open] = calendar.create(member('admin'), draft('t-damen'));
    expect(() => calendar.respond(member('spielerin'), past.id, { status: 'YES' })).toThrow(expect.objectContaining({ code: 'attendance.closed' }));
    expect(() => calendar.respond(member('admin'), open.id, { status: 'YES' })).toThrow(expect.objectContaining({ code: 'attendance.not-in-team' }));

    calendar.respond(member('spielerin'), open.id, { status: 'NO', reason: 'Krank' });
    const coachView = calendar.overview(member('trainer'), open.id);
    expect(coachView).toMatchObject({ no: 1 });
    expect(coachView.entries.find((e) => e.memberId === 'spielerin')?.reason).toBe('Krank');
    expect(calendar.overview(member('neu'), open.id).entries.find((e) => e.memberId === 'spielerin')?.reason).toBeNull();
  });

  it('a new time asks for a confirmation and tells the team; a cancellation can be taken back', async () => {
    const { notifications } = await import('../notifications/mock');
    const soon = new Date(Date.now() + 3 * 86_400_000);
    const [training] = calendar.create(
      member('admin'),
      draft('t-u16', { startsAt: soon.toISOString(), endsAt: new Date(soon.getTime() + 3_600_000).toISOString() }),
    );
    calendar.respond(member('spieler'), training.id, { status: 'YES' });
    calendar.update(member('admin'), training.id, {
      startsAt: new Date(soon.getTime() + 3_600_000).toISOString(),
      endsAt: new Date(soon.getTime() + 7_200_000).toISOString(),
    });
    expect(calendar.overview(member('trainer'), training.id).entries.find((e) => e.memberId === 'spieler')?.unconfirmed).toBe(true);
    expect(notifications.list('spieler', false).items[0]).toMatchObject({ kind: 'APPOINTMENT_CHANGED' });
    calendar.respond(member('spieler'), training.id, { status: 'YES' });
    expect(calendar.overview(member('trainer'), training.id).entries.find((e) => e.memberId === 'spieler')?.unconfirmed).toBe(false);

    calendar.cancel(member('admin'), training.id, false, 'Halle gesperrt');
    expect(calendar.visible(member('spieler'), training.id)).toMatchObject({ cancelled: true, cancelReason: 'Halle gesperrt' });
    expect(calendar.restore(member('admin'), training.id)).toMatchObject({ cancelled: false, cancelReason: null });
    expect(() => calendar.delete(member('admin'), training.id)).toThrow(expect.objectContaining({ code: 'appointment.has-answers' }));
  });

  it('reminds open answers once, lists them on the start page and lets coaches mark presence', () => {
    const soon = new Date(Date.now() + 2 * 86_400_000);
    const [match] = calendar.create(
      member('admin'),
      draft('t-u16', { type: 'MATCH', startsAt: soon.toISOString(), endsAt: new Date(soon.getTime() + 3_600_000).toISOString() }),
    );
    expect(calendar.openAnswers(member('spieler')).items.some((o) => o.appointmentId === match.id)).toBe(true);
    expect(calendar.remindOpen(member('trainer'), match.id)).toBeGreaterThan(0);
    expect(calendar.remindOpen(member('trainer'), match.id)).toBe(0);
    expect(() => calendar.remindOpen(member('spieler'), match.id)).toThrow(expect.objectContaining({ status: 403 }));

    const [past] = calendar.create(
      member('admin'),
      draft('t-u16', { startsAt: new Date(Date.now() - 7_200_000).toISOString(), endsAt: new Date(Date.now() - 3_600_000).toISOString() }),
    );
    const marked = calendar.setPresence(member('trainer'), past.id, { memberId: 'spieler', present: true });
    expect(marked.entries.find((e) => e.memberId === 'spieler')?.present).toBe(true);
    const today = directory.clock.today();
    const stats = calendar.teamStats(member('trainer'), 't-u16', '2020-01-01', today);
    expect(stats.items.find((m) => m.memberId === 'spieler')).toMatchObject({ present: 1, marked: 1 });
  });

  it('skips holidays in new series, extends a series in its rhythm and marks own answers', () => {
    calendar.saveHoliday(member('admin'), null, { name: 'Ferien', from: '2027-02-08', to: '2027-02-14' });
    const created = calendar.create(
      member('admin'),
      draft('t-u16', {
        startsAt: '2027-02-01T17:00:00.000Z',
        endsAt: '2027-02-01T18:30:00.000Z',
        repeatUntil: '2027-02-15',
        intervalWeeks: 1,
        intervalMonths: null,
        byWeekday: false,
      }),
    );
    expect(created.map((a) => a.startsAt.slice(0, 10))).toEqual(['2027-02-01', '2027-02-15']);
    const added = calendar.extend(member('admin'), created[0].id, '2027-03-01');
    expect(added.map((a) => a.startsAt.slice(0, 10))).toEqual(['2027-02-22', '2027-03-01']);
    calendar.respond(member('spieler'), created[0].id, { status: 'YES' });
    expect(calendar.myAnswers(member('eltern'), '2027-01-01T00:00:00Z', '2027-04-01T00:00:00Z')).toContainEqual({
      appointmentId: created[0].id,
      memberId: 'spieler',
      status: 'YES',
    });
    for (const h of [...calendar.holidays.data]) calendar.deleteHoliday(member('admin'), h.id);
  });

  it('car pools: one seat per member and appointment, full cars refuse', () => {
    const [created] = calendar.create(member('admin'), draft(null, { type: 'MATCH', title: 'Auswärts' }));
    const ride = calendar.offerRide(member('admin'), created.id, { seats: 1, note: ' ab Halle ' });
    expect(ride.note).toBe('ab Halle');
    expect(() => calendar.offerRide(member('admin'), created.id, { seats: 2 })).toThrow(expect.objectContaining({ code: 'ride.exists' }));
    expect(calendar.joinRide(member('spieler'), ride.id, {}).passengers.map((p) => p.memberId)).toEqual(['spieler']);
    expect(() => calendar.joinRide(member('trainer'), ride.id, {})).toThrow(expect.objectContaining({ code: 'ride.full' }));
    expect(() => calendar.leaveRide(member('trainer'), ride.id, 'spieler')).toThrow(expect.objectContaining({ status: 403 }));
    // Offering an own car frees the seat elsewhere.
    calendar.offerRide(member('spieler'), created.id, { seats: 3 });
    expect(calendar.listRides(member('admin'), created.id).find((r) => r.id === ride.id)!.passengers).toEqual([]);
    expect(() => calendar.cancelRide(member('trainer'), ride.id)).toThrow(expect.objectContaining({ code: 'ride.not-driver' }));
    calendar.cancelRide(member('admin'), ride.id);
    expect(calendar.listRides(member('admin'), created.id)).toHaveLength(1);
    // Switched off for the appointment: no new cars.
    calendar.update(member('admin'), created.id, { rides: false });
    expect(() => calendar.offerRide(member('trainer'), created.id, { seats: 2 })).toThrow(expect.objectContaining({ code: 'ride.not-offered' }));
    const [training] = calendar.create(member('admin'), draft(null, { type: 'TRAINING', title: 'Training' }));
    expect(training.rides).toBe(false);
  });

  it('calendar settings: admin/board only, cabins follow the labels, seats the limit', () => {
    const before = calendar.settings();
    expect(() => calendar.saveSettings(member('spieler'), before)).toThrow(expect.objectContaining({ status: 403 }));
    expect(() => calendar.saveSettings(member('admin'), { ...before, openAnswerDays: 3 })).toThrow(
      expect.objectContaining({ code: 'calendar-settings.invalid' }),
    );
    calendar.saveSettings(member('admin'), { ...before, cabinLabels: ['A'], maxRideSeats: 2 });
    expect(() => calendar.create(member('trainer'), draft('t-u16', { cabins: ['1', '2'] }))).toThrow(
      expect.objectContaining({ code: 'appointment.cabin-not-allowed' }),
    );
    const [match] = calendar.create(member('admin'), draft(null, { type: 'MATCH', title: 'Auswärts', cabins: ['1', ''] }));
    expect(match.cabins).toEqual(['1']);
    expect(() => calendar.offerRide(member('admin'), match.id, { seats: 3 })).toThrow(expect.objectContaining({ code: 'ride.seats-invalid' }));
    calendar.saveSettings(member('admin'), before);
  });

  it('links places, keeps their name as text and checks cabins', () => {
    const [created] = calendar.create(member('trainer'), draft('t-u16', { locationId: 'l-sued', location: 'egal', cabins: [' Kabine 2 ', ' ', ''] }));
    expect(created).toMatchObject({ location: 'Turnhalle Süd', locationId: 'l-sued', cabins: ['Kabine 2'] });
    expect(() => calendar.create(member('trainer'), draft('t-u16', { type: 'MEETING', cabins: ['Kabine 1'] }))).toThrow(
      expect.objectContaining({ code: 'appointment.cabin-not-allowed' }),
    );
    expect(() => calendar.update(member('trainer'), created.id, { locationId: 'nope' })).toThrow(
      expect.objectContaining({ code: 'appointment.location-unknown' }),
    );
    const moved = calendar.update(member('trainer'), created.id, { clearLocationId: true, location: 'Beachplatz', cabins: [] });
    expect(moved).toMatchObject({ locationId: null, location: 'Beachplatz', cabins: [] });
  });

  it('reminds holders of needed items once, guardians included', async () => {
    const { notifications } = await import('../notifications/mock');
    const soon = new Date(Date.now() + 3 * 3_600_000).toISOString();
    const [match] = calendar.create(
      member('trainer'),
      draft('t-u16', { type: 'MATCH', title: 'Auswärtsspiel', startsAt: soon, endsAt: new Date(Date.parse(soon) + 7_200_000).toISOString() }),
    );
    const { inventory } = await import('../inventory/mock');
    inventory.setStock(member('trainer'), 'i-cart', [
      { locationId: null, holderId: 'spieler', quantity: 2 },
      { locationId: 'l-nord', holderId: null, quantity: 1 },
    ]);
    calendar.links.set(member('trainer'), match.id, { needs: [{ itemId: 'i-cart', quantity: 1 }], fileIds: [] });
    calendar.remindItemHolders();
    calendar.remindItemHolders();
    for (const id of ['spieler', 'eltern']) {
      expect(
        notifications
          .list(id, true)
          .items.filter((n) => n.kind === 'ITEM_REMINDER')
          .map((n) => n.title),
        id,
      ).toEqual(['Mitbringen: 1× Ballwagen']);
    }
  });
});

describe('mock appointment types', () => {
  it('are added by the board, offer cabins only where set, and are archived once used', async () => {
    const { appointmentTypes } = await import('./mock');
    const board = directory.members.data.find((m) => m.id === 'vorstand')!;
    expect(() => appointmentTypes.save(board, null, { label: 'Kurs', hue: 'pink', sort: 1 })).toThrow();
    const kurs = appointmentTypes.save(board, null, { label: 'Kurs', hue: 'green', rides: false, cabins: false, sort: 9, ...RULES });
    const start = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const end = new Date(Date.now() + 3 * 86_400_000 + 3_600_000).toISOString();
    const base = {
      teamId: null,
      type: kurs.key,
      title: 'Kurs',
      description: null,
      location: null,
      locationId: null,
      startsAt: start,
      endsAt: end,
      repeatUntil: null,
      intervalWeeks: null,
      intervalMonths: null,
      byWeekday: false,
    };
    expect(() => calendar.create(board, { ...base, cabins: ['Kabine 1'] } as never)).toThrow();
    calendar.create(board, { ...base, cabins: [] } as never);
    expect(appointmentTypes.list().items.find((t) => t.key === kurs.key)?.inUse).toBe(true);
    expect(() => appointmentTypes.delete(board, kurs.key)).toThrow();
  });

  it('hold the answer rules and the longest duration (server: AppointmentTypesIT.typeRules)', async () => {
    const { appointmentTypes } = await import('./mock');
    const board = member('vorstand');
    const code = (c: string) => expect.objectContaining({ code: c });
    expect(() => appointmentTypes.save(board, null, { label: 'X', hue: 'green', sort: 9, ...RULES, defaultMinutes: 2000, maxDays: 1 })).toThrow(
      code('appointment-type.rules-invalid'),
    );
    const strict = { label: 'Streng', hue: 'green', sort: 9, ...RULES, maxDays: 1, answerDeadlineHours: 96, allowMaybe: false, reasonOnNo: true };
    const key = appointmentTypes.save(board, null, strict).key;
    const start = Date.now() + 3 * 86_400_000;
    const at = (ms: number) => new Date(ms).toISOString();
    expect(() => calendar.create(board, { ...draft(null), type: key, startsAt: at(start), endsAt: at(start + 2 * 86_400_000) })).toThrow(
      code('appointment.too-long'),
    );
    const id = calendar.create(board, { ...draft(null), type: key, startsAt: at(start), endsAt: at(start + 3_600_000) })[0].id;
    const player = member('spielerin');
    expect(() => calendar.respond(player, id, { status: 'YES' })).toThrow(code('attendance.deadline-passed'));
    appointmentTypes.save(board, key, { ...strict, answerDeadlineHours: 0 });
    expect(() => calendar.respond(player, id, { status: 'MAYBE' })).toThrow(code('attendance.maybe-off'));
    expect(() => calendar.respond(player, id, { status: 'NO', reason: ' ' })).toThrow(code('attendance.reason-required'));
    calendar.respond(player, id, { status: 'NO', reason: 'Krank' });
    appointmentTypes.save(board, key, { ...strict, answerDeadlineHours: 0, expectAnswers: 'NONE' });
    expect(() => calendar.respond(player, id, { status: 'YES' })).toThrow(code('attendance.answers-off'));
  });

  it('club sign-ups, a minimum shift, a second reminder and self check-in (server: AppointmentChangesIT)', async () => {
    const { appointmentTypes } = await import('./mock');
    const board = member('vorstand');
    const code = (c: string) => expect.objectContaining({ code: c });
    const fest = { label: 'Fest', hue: 'green', sort: 9, ...RULES, expectAnswers: 'CLUB', minShiftMinutes: 30, selfCheckIn: true, remindHours: 48 };
    expect(() => appointmentTypes.save(board, null, { ...fest, remindAgainHours: 48 })).toThrow(code('appointment-type.rules-invalid'));
    const key = appointmentTypes.save(board, null, { ...fest, remindAgainHours: 30 }).key;
    const at = (ms: number) => new Date(ms).toISOString();
    const start = Date.now() + 86_400_000;
    const id = calendar.create(board, { ...draft(null), type: key, startsAt: at(start), endsAt: at(start + 3_600_000) })[0].id;

    calendar.respond(member('spieler'), id, { status: 'YES' });
    const parent = calendar.openAnswers(member('eltern')).items.filter((o) => o.appointmentId === id);
    expect(parent.map((o) => o.memberId)).toEqual(['eltern']); // the ward (spieler) answered already
    expect(calendar.overview(board, id).open).toBe(directory.audienceIds({ everyone: true }).length - 1);

    calendar.remindDue();
    calendar.remindDue();
    expect(calendar.openReminded.data.filter((k) => k.startsWith(id))).toEqual([`${id}:2`]);

    calendar.update(board, id, { startsAt: at(start + 15 * 60_000), endsAt: at(start + 75 * 60_000) });
    expect(calendar.overview(board, id).entries.find((e) => e.memberId === 'spieler')?.unconfirmed).toBe(false);

    const running = calendar.create(board, { ...draft(null), type: key, startsAt: at(Date.now() - 3_600_000), endsAt: at(Date.now() + 3_600_000) })[0]
      .id;
    const own = calendar.setPresence(member('spieler'), running, { memberId: 'spieler', present: true });
    expect(own.entries.find((e) => e.memberId === 'spieler')?.present).toBe(true);
    expect(() => calendar.setPresence(member('spieler'), running, { memberId: 'spielerin', present: true })).toThrow(
      expect.objectContaining({ status: 404 }),
    );
  });
});
