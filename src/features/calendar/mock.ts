// Mock of the club-server calendar and attendance modules (visibility, edit rights, series, answers).
import { activity, MockActivity } from '../../lib/mock/MockActivity';
import { settings } from '../../settings';
import { directory, type MockDirectory } from '../../lib/mock/core';
import { itemUseSources, MockLinks, type ItemUse } from '../../lib/mock/MockLinks';
import { MockServer, mockServer, type MockRequest } from '../../lib/mock/MockServer';
import { MockTable } from '../../lib/mock/MockTable';
import { ZonedClock, type LocalDate } from '../../lib/time/ZonedClock';
import type { Member } from '../../lib/types';
import { HUES, SEEDED_APPOINTMENT_TYPES, type Absence, type AppointmentTypeInfo, type Appointment, type AppointmentPatch, type Ride, type AppointmentType, type Attendance, type AttendanceEntry, type NewAppointment, type ResponseStatus } from './model';
import { locations } from '../locations/mock';
import { inventory } from '../inventory/mock';

/** server: attendance_ride + attendance_ride_passenger */
interface StoredRide {
  id: string;
  appointmentId: string;
  driverId: string;
  seats: number;
  note: string | null;
  passengers: string[];
}

interface StoredResponse {
  status: ResponseStatus;
  reason: string | null;
  updatedAt: string;
}

const fail = MockServer.fail;
const limits = settings.calendar;
const DAY_MS = 86_400_000;
/** server: calendar_type (`inUse` computed when listed). */
const types = new MockTable<AppointmentTypeInfo[]>('appointment-types', () => structuredClone([...SEEDED_APPOINTMENT_TYPES]));
const typeOf = (key: AppointmentType): AppointmentTypeInfo => types.data.find((t) => t.key === key) ?? fail(400, 'appointment.type-unknown');
const STATUSES: readonly ResponseStatus[] = ['YES', 'NO', 'MAYBE'];

export class MockCalendar {
  readonly appointments: MockTable<Appointment[]>;
  /** appointmentId → memberId → answer */
  readonly responses: MockTable<Record<string, Record<string, StoredResponse>>>;
  /** memberId → feed token */
  readonly feeds = new MockTable<Record<string, string>>('ical', () => ({}));
  /** server: attendance_absence */
  readonly absences = new MockTable<Absence[]>('absences', () => []);
  readonly rides: MockTable<StoredRide[]>;

  constructor(private readonly people: MockDirectory) {
    this.appointments = new MockTable('appointments', () => this.seedAppointments());
    this.upgradeStored();
    this.responses = new MockTable('responses', () => this.seedResponses());
    this.rides = new MockTable('rides', () => this.seedRides());
    this.links = new MockLinks('calendar-links', () => this.seedLinks());
    this.reminded = new MockTable<string[]>('need-reminders', () => []);
    mockServer.events.subscribe((event) => event.type === 'locations.location-changed' && this.onLocationChanged(event.data as never));
  }

  /** "Benötigt" list and attachments (server: CalendarHandlers.getLinks / setLinks). */
  readonly links: MockLinks;
  /** "appointmentId:itemId:memberId" of sent reminders (server: calendar_need_reminder). */
  readonly reminded: MockTable<string[]>;

  getLinks(member: Member, id: string) {
    return this.links.get(member, this.visible(member, id).id);
  }

  /** server: CalendarHandlers.itemUses */
  itemUses(member: Member, itemId: string): ItemUse[] {
    const now = Date.now();
    return this.links.owners(itemId)
      .flatMap(([id, quantity]) => {
        const a = this.appointments.data.find((x) => x.id === id);
        return a && this.canSee(member, a) && !a.cancelled && Date.parse(a.endsAt) > now
          ? [{ kind: 'APPOINTMENT' as const, id: a.id, title: a.title, at: a.startsAt, quantity }]
          : [];
      })
      .sort((x, y) => x.at!.localeCompare(y.at!));
  }

  setLinks(member: Member, id: string, body: Record<string, unknown>) {
    const appointment = this.visible(member, id);
    this.requireMayEdit(member, appointment.teamId);
    const links = this.links.set(member, appointment.id, body);
    this.changed(member, [appointment], 'UPDATED');
    MockActivity.record('APPOINTMENT', appointment.id, member, 'UPDATED', { title: appointment.title, teamIds: appointment.teamId ? [appointment.teamId] : [] });
    return links;
  }

  list(member: Member, from: string | null, to: string | null, teamId: string | null): Appointment[] {
    if (!from || !to || isNaN(Date.parse(from)) || isNaN(Date.parse(to))) return fail(400, 'request.invalid');
    const span = Date.parse(to) - Date.parse(from);
    if (span <= 0 || span > limits.maxRangeDays * DAY_MS) fail(400, 'calendar.range-invalid');
    return this.appointments.data
      .filter((a) => a.startsAt < to && a.endsAt > from && (!teamId || a.teamId === teamId) && this.canSee(member, a))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  /** Not visible answers 404, like the server (no probing of ids). */
  visible(member: Member, id: string): Appointment {
    const appointment = this.appointments.data.find((a) => a.id === id);
    if (!appointment || !this.canSee(member, appointment)) return fail(404, 'appointment.not-found');
    return appointment;
  }

  create(member: Member, body: NewAppointment): Appointment[] {
    if (body.teamId && !this.people.teams.data.some((t) => t.id === body.teamId)) fail(409, 'data.conflict');
    this.requireMayEdit(member, body.teamId ?? null);
    if (typeOf(body.type).archived) fail(400, 'appointment.type-archived');
    const rides = body.rides ?? typeOf(body.type).rides;
    const first = MockCalendar.validated(this.placed({ ...body, id: '', seriesId: null, cancelled: false, rides }, body.locationId ?? null));
    const starts = this.occurrences(first.startsAt, body.repeatUntil, body.intervalWeeks);
    const seriesId = starts.length > 1 || body.repeatUntil ? crypto.randomUUID() : null;
    const duration = Date.parse(first.endsAt) - Date.parse(first.startsAt);
    const created = starts.map((startsAt) => ({
      ...first,
      id: crypto.randomUUID(),
      seriesId,
      startsAt,
      endsAt: new Date(Date.parse(startsAt) + duration).toISOString(),
    }));
    this.appointments.data.push(...created);
    this.appointments.save();
    this.changed(member, created, 'CREATED');
    created.forEach((a) => MockActivity.record('APPOINTMENT', a.id, member, 'CREATED', { title: a.title, teamIds: a.teamId ? [a.teamId] : [] }));
    return created;
  }

  update(member: Member, id: string, patch: AppointmentPatch): Appointment {
    const current = this.visible(member, id);
    this.requireMayEdit(member, current.teamId);
    const { clearLocationId, ...rest } = patch;
    const defined = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== null && v !== undefined));
    const merged = { ...current, ...defined };
    const next = MockCalendar.validated(clearLocationId ? { ...merged, locationId: null } : this.placed(merged, patch.locationId ?? null));
    Object.assign(current, next);
    this.appointments.save();
    this.changed(member, [current], 'UPDATED');
    MockActivity.record('APPOINTMENT', current.id, member, 'UPDATED', { title: current.title, teamIds: current.teamId ? [current.teamId] : [] });
    return current;
  }

  cancel(member: Member, id: string, includeFollowing: boolean): Appointment[] {
    const current = this.visible(member, id);
    this.requireMayEdit(member, current.teamId);
    const targets =
      includeFollowing && current.seriesId
        ? this.appointments.data.filter((a) => a.seriesId === current.seriesId && a.startsAt >= current.startsAt && !a.cancelled)
        : [current];
    targets.forEach((a) => (a.cancelled = true));
    this.appointments.save();
    this.changed(member, targets, 'CANCELLED');
    targets.forEach((a) => MockActivity.record('APPOINTMENT', a.id, member, 'CANCELLED', { title: a.title, teamIds: a.teamId ? [a.teamId] : [] }));
    return targets;
  }

  /** server: AttendanceHandlers.respond */
  respond(member: Member, id: string, body: { memberId?: string | null; status?: string; reason?: string | null }): unknown {
    const appointment = this.visible(member, id);
    const target = body.memberId ?? member.id;
    if (target !== member.id && !this.people.wardsOf(member.id).includes(target)) fail(404, 'member.not-found');
    if (!body.status || !STATUSES.includes(body.status as ResponseStatus)) fail(400, 'attendance.status-missing');
    if ((body.reason?.length ?? 0) > limits.reasonMaxLength) fail(400, 'attendance.reason-too-long');
    if (appointment.cancelled) fail(409, 'attendance.appointment-cancelled');
    if (Date.parse(appointment.startsAt) <= Date.now()) fail(409, 'attendance.closed');
    if (appointment.teamId && !(appointment.teamId in this.people.teamRoles(target))) fail(403, 'attendance.not-in-team');
    const response: StoredResponse = {
      status: body.status as ResponseStatus,
      reason: body.reason?.trim() || null,
      updatedAt: new Date().toISOString(),
    };
    (this.responses.data[id] ??= {})[target] = response;
    this.responses.save();
    mockServer.events.publish({
      type: 'attendance.response-changed',
      data: { appointmentId: id, memberId: target, status: response.status },
      audience: this.people.teamAudience(appointment.teamId),
    });
    return { appointmentId: id, memberId: target, ...response };
  }

  /** server: AttendanceHandlers.overview */
  overview(member: Member, id: string): Attendance {
    const appointment = this.visible(member, id);
    const answers = this.responses.data[id] ?? {};
    const expected = new Set(Object.keys(answers));
    if (appointment.teamId) this.people.teamMembers(appointment.teamId).forEach((m) => expected.add(m));
    // server: an absence on the appointment's local day counts as NO until the member answers.
    const day = this.people.clock.localDate(appointment.startsAt);
    const showReasons =
      this.people.isManager(member) ||
      (appointment.teamId !== null && this.people.teamRoles(member.id)[appointment.teamId] === 'COACH');
    const entries: AttendanceEntry[] = [...expected]
      .flatMap((memberId): AttendanceEntry[] => {
        const name = this.people.name(memberId);
        if (!name) return [];
        const answer = answers[memberId];
        const away = answer ? undefined : this.absences.data.find((a) => a.memberId === memberId && a.from <= day && day <= a.to);
        if (away) {
          return [{ memberId, name, status: 'NO' as const, reason: showReasons ? (away.reason ? `Abwesend: ${away.reason}` : 'Abwesend') : null, updatedAt: null, absent: true }];
        }
        return [{
          memberId,
          name,
          status: answer?.status ?? null,
          reason: showReasons ? (answer?.reason ?? null) : null,
          updatedAt: answer?.updatedAt ?? null,
          absent: false,
        }];
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    const count = (status: ResponseStatus | null) => entries.filter((e) => e.status === status).length;
    return { appointmentId: id, yes: count('YES'), no: count('NO'), maybe: count('MAYBE'), open: count(null), entries };
  }

  /** server: AttendanceHandlers.addAbsence / listAbsences / deleteAbsence */
  addAbsence(member: Member, body: { memberId?: string | null; from?: string; to?: string; reason?: string | null }): Absence {
    const target = body.memberId ?? member.id;
    if (target !== member.id && !this.people.wardsOf(member.id).includes(target)) fail(404, 'member.not-found');
    const date = /^\d{4}-\d{2}-\d{2}$/;
    if (!body.from || !body.to || !date.test(body.from) || !date.test(body.to) || body.to < body.from) fail(400, 'absence.range-invalid');
    if ((Date.parse(body.to!) - Date.parse(body.from!)) / 86_400_000 >= 366) fail(400, 'absence.too-long');
    if ((body.reason?.length ?? 0) > limits.reasonMaxLength) fail(400, 'absence.reason-too-long');
    const absence: Absence = { id: crypto.randomUUID(), memberId: target, from: body.from!, to: body.to!, reason: body.reason?.trim() || null };
    this.absences.data.push(absence);
    this.absences.save();
    return absence;
  }

  listAbsences(member: Member): Absence[] {
    const mine = new Set([member.id, ...this.people.wardsOf(member.id)]);
    const today = this.people.clock.today();
    return this.absences.data.filter((a) => mine.has(a.memberId) && a.to >= today).sort((a, b) => a.from.localeCompare(b.from));
  }

  /** server: AttendanceHandlers.calendarMove — the member or a guardian moves the absence. */
  moveAbsence(member: Member, id: string, from: string, to: string): void {
    const absence = this.absences.data.find((a) => a.id === id);
    if (!absence || (absence.memberId !== member.id && !this.people.wardsOf(member.id).includes(absence.memberId))) fail(404, 'absence.not-found');
    if (to < from) fail(400, 'absence.range-invalid');
    Object.assign(absence!, { from, to });
    this.absences.save();
  }

  deleteAbsence(member: Member, id: string): void {
    const absence = this.absences.data.find((a) => a.id === id);
    if (!absence || (absence.memberId !== member.id && !this.people.wardsOf(member.id).includes(absence.memberId))) fail(404, 'absence.not-found');
    this.absences.data.splice(this.absences.data.indexOf(absence!), 1);
    this.absences.save();
  }

  /** server: AttendanceHandlers.listRides / offerRide / cancelRide / joinRide / leaveRide */
  listRides(member: Member, appointmentId: string): Ride[] {
    const appointment = this.visible(member, appointmentId);
    return this.rides.data.filter((r) => r.appointmentId === appointment.id).map((r) => this.rideDto(r));
  }

  offerRide(member: Member, appointmentId: string, body: { seats?: number; note?: string | null }): Ride {
    const appointment = this.open(member, appointmentId);
    this.requireRides(appointment);
    const seats = Number(body.seats);
    if (!Number.isInteger(seats) || seats < 1 || seats > 8) fail(400, 'ride.seats-invalid');
    if ((body.note?.length ?? 0) > 200) fail(400, 'ride.note-too-long');
    const all = this.rides.data.filter((r) => r.appointmentId === appointment.id);
    if (all.some((r) => r.driverId === member.id)) fail(409, 'ride.exists');
    all.forEach((r) => (r.passengers = r.passengers.filter((p) => p !== member.id)));
    const ride: StoredRide = { id: crypto.randomUUID(), appointmentId, driverId: member.id, seats, note: body.note?.trim() || null, passengers: [] };
    this.rides.data.push(ride);
    this.ridesChanged(appointment);
    return this.rideDto(ride);
  }

  /** server: RideHandlers.requireRides — new rides and passengers only where the club and the appointment offer car pools. */
  private requireRides(appointment: Appointment): void {
    if (!appointment.rides || !this.people.clubInfo().ridesEnabled) fail(409, 'ride.not-offered');
  }

  cancelRide(member: Member, rideId: string): void {
    const ride = this.ride(member, rideId);
    if (ride.driverId !== member.id && !this.people.isManager(member)) fail(403, 'ride.not-driver');
    this.rides.data.splice(this.rides.data.indexOf(ride), 1);
    this.ridesChanged(this.visible(member, ride.appointmentId));
  }

  joinRide(member: Member, rideId: string, body: { memberId?: string | null }): Ride {
    const ride = this.ride(member, rideId);
    const appointment = this.open(member, ride.appointmentId);
    this.requireRides(appointment);
    const target = body.memberId ?? member.id;
    if (target !== member.id && !this.people.wardsOf(member.id).includes(target)) fail(404, 'member.not-found');
    const all = this.rides.data.filter((r) => r.appointmentId === appointment.id);
    if (target === ride.driverId) fail(400, 'ride.driver-is-passenger');
    if (all.some((r) => r.driverId === target)) fail(409, 'ride.is-driver');
    if (!ride.passengers.includes(target) && ride.passengers.length >= ride.seats) fail(409, 'ride.full');
    all.forEach((r) => (r.passengers = r.passengers.filter((p) => p !== target)));
    ride.passengers.push(target);
    this.ridesChanged(appointment);
    return this.rideDto(ride);
  }

  leaveRide(member: Member, rideId: string, memberId: string): Ride {
    const ride = this.ride(member, rideId);
    const allowed = memberId === member.id || ride.driverId === member.id || this.people.isManager(member) || this.people.wardsOf(member.id).includes(memberId);
    if (!allowed) fail(403, 'ride.not-passenger');
    ride.passengers = ride.passengers.filter((p) => p !== memberId);
    this.ridesChanged(this.visible(member, ride.appointmentId));
    return this.rideDto(ride);
  }

  private ride(member: Member, rideId: string): StoredRide {
    const ride = this.rides.data.find((r) => r.id === rideId);
    if (!ride) return fail(404, 'ride.not-found');
    this.visible(member, ride.appointmentId);
    return ride;
  }

  /** Visible, not cancelled, not started. */
  private open(member: Member, id: string): Appointment {
    const appointment = this.visible(member, id);
    if (appointment.cancelled) fail(409, 'attendance.appointment-cancelled');
    if (Date.parse(appointment.startsAt) <= Date.now()) fail(409, 'attendance.closed');
    return appointment;
  }

  private ridesChanged(appointment: Appointment): void {
    this.rides.save();
    mockServer.events.publish({
      type: 'attendance.rides-changed',
      data: { appointmentId: appointment.id },
      audience: this.people.teamAudience(appointment.teamId),
    });
  }

  private rideDto(r: StoredRide): Ride {
    const name = (id: string) => this.people.name(id) ?? 'Mitglied';
    return {
      ...r,
      driverName: name(r.driverId),
      passengers: r.passengers.map((memberId) => ({ memberId, name: name(memberId) })).sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  issueFeed(member: Member): { url: string } {
    const token = crypto.randomUUID().replaceAll('-', '');
    this.feeds.data[member.id] = token;
    this.feeds.save();
    return { url: `/ical/${token}.ics` };
  }

  revokeFeed(member: Member): void {
    delete this.feeds.data[member.id];
    this.feeds.save();
  }

  /** server: CalendarApi.AppointmentsChanged, pushed to everyone who sees the appointments */
  private changed(actor: Member, appointments: readonly Appointment[], change: 'CREATED' | 'UPDATED' | 'CANCELLED'): void {
    const [first] = appointments;
    if (!first) return;
    mockServer.events.publish({
      type: 'calendar.appointments-changed',
      data: { appointmentIds: appointments.map((a) => a.id), teamId: first.teamId, change, actorId: actor.id, title: first.title, firstStartsAt: first.startsAt },
      audience: this.people.teamAudience(first.teamId),
    });
  }

  /** server: CalendarHandlers.Viewer.canSee */
  private canSee(member: Member, appointment: Appointment): boolean {
    return appointment.teamId === null || this.people.isManager(member) || this.people.visibleTeamIds(member.id).has(appointment.teamId);
  }

  /** server: CalendarHandlers.requireMayEdit */
  private requireMayEdit(member: Member, teamId: string | null): void {
    if (teamId === null || this.people.isManager(member)) {
      this.people.requirePrivileged(member, ['ADMIN', 'BOARD']);
      return;
    }
    if (this.people.teamRoles(member.id)[teamId] !== 'COACH') fail(403, 'access.denied');
    this.people.requirePrivileged(member, ['COACH']);
  }

  /** Start instants of a weekly series in club time (same wall-clock time each week, across DST). */
  private occurrences(startsAt: string, repeatUntil: LocalDate | null, intervalWeeks: number | null): string[] {
    if (!repeatUntil) return [startsAt];
    const interval = intervalWeeks ?? 1;
    if (!Number.isInteger(interval) || interval < 1 || interval > limits.maxIntervalWeeks) fail(400, 'appointment.interval-invalid');
    const clock = this.people.clock;
    const local = clock.toLocal(startsAt);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(repeatUntil) || repeatUntil < local.slice(0, 10)) fail(400, 'appointment.repeat-until-invalid');
    const starts: string[] = [];
    for (let date = local.slice(0, 10); date <= repeatUntil; date = ZonedClock.addDays(date, 7 * interval)) {
      if (starts.length === limits.maxSeriesOccurrences) fail(400, 'appointment.series-too-long');
      starts.push(clock.toInstant(`${date}T${local.slice(11)}`));
    }
    return starts;
  }

  /** server: CalendarHandlers.remindItemHolders - holders of needed items, once per appointment, item and person. */
  remindItemHolders(beforeMs: number): void {
    const now = Date.now();
    const due = this.appointments.data.filter((a) => !a.cancelled && Date.parse(a.startsAt) >= now && Date.parse(a.startsAt) < now + beforeMs);
    for (const appointment of due) {
      const needs = this.links.table.data[appointment.id]?.needs ?? [];
      const held = inventory.holdings(needs.map((n) => n.itemId));
      const bring = new Map<string, { name: string; quantity: number }[]>();
      for (const need of needs) {
        for (const [holder, quantity] of Object.entries(held[need.itemId] ?? {})) {
          const key = `${appointment.id}:${need.itemId}:${holder}`;
          if (this.reminded.data.includes(key)) continue;
          this.reminded.data.push(key);
          const name = inventory.items.data.find((i) => i.id === need.itemId)?.name ?? need.name;
          bring.set(holder, [...(bring.get(holder) ?? []), { name, quantity: Math.min(quantity, need.quantity) }]);
        }
      }
      for (const [holder, items] of bring) {
        mockServer.events.publish({
          type: 'calendar.items-to-bring',
          data: { memberId: holder, recipients: [holder, ...this.people.guardiansOf([holder])], appointmentId: appointment.id,
            title: appointment.title, startsAt: appointment.startsAt, items },
        });
      }
    }
    this.reminded.save();
  }

  /**
   * Appointments a browser stored before places existed (server: migration V26): link the place with the same
   * name, no cabins yet.
   */
  private upgradeStored(): void {
    const old = this.appointments.data.filter((a) => a.locationId === undefined);
    if (!old.length) return;
    const byName = new Map(locations.list().map((l) => [l.name.toLowerCase(), l.id]));
    old.forEach((a) => Object.assign(a, { locationId: (a.location && byName.get(a.location.toLowerCase())) ?? null, cabinMen: null, cabinWomen: null }));
    this.appointments.save();
  }

  /** server: CalendarHandlers.placeName - a linked place puts its name into the location text. */
  private placed<T extends { location: string | null; locationId: string | null }>(a: T, locationId: string | null): T {
    if (!locationId) return a;
    const place = locations.ref(locationId) ?? fail(400, 'appointment.location-unknown');
    return { ...a, locationId, location: place.name };
  }

  /** server: CalendarHandlers.onLocationChanged */
  private onLocationChanged(data: { locationId: string; change: string; name: string }): void {
    if (data.change === 'CREATED') return;
    const linked = this.appointments.data.filter((a) => a.locationId === data.locationId);
    linked.forEach((a) => Object.assign(a, { location: data.name, ...(data.change === 'DELETED' ? { locationId: null } : {}) }));
    if (linked.length) this.appointments.save();
  }

  /** server: Appointment constructor checks */
  private static validated<T extends Omit<Appointment, 'id' | 'seriesId' | 'cancelled'> & Partial<Appointment>>(a: T): T {
    if (!a.type) fail(400, 'appointment.type-missing');
    const type = typeOf(a.type);
    if (!a.title?.trim() || a.title.length > limits.titleMaxLength) fail(400, 'appointment.title-invalid');
    if ((a.description?.length ?? 0) > limits.descriptionMaxLength) fail(400, 'appointment.description-too-long');
    if ((a.location?.length ?? 0) > limits.locationMaxLength) fail(400, 'appointment.location-too-long');
    const cabinMen = a.cabinMen?.trim() || null;
    const cabinWomen = a.cabinWomen?.trim() || null;
    if ((cabinMen?.length ?? 0) > limits.cabinMaxLength || (cabinWomen?.length ?? 0) > limits.cabinMaxLength) fail(400, 'appointment.cabin-too-long');
    if ((cabinMen || cabinWomen) && !type.cabins) fail(400, 'appointment.cabin-not-allowed');
    const start = Date.parse(a.startsAt);
    const end = Date.parse(a.endsAt);
    if (isNaN(start) || isNaN(end) || end <= start) fail(400, 'appointment.times-invalid');
    if (end - start > limits.maxDurationDays * DAY_MS) fail(400, 'appointment.too-long');
    return { ...a, title: a.title.trim(), description: a.description || null, location: a.location || null, locationId: a.locationId ?? null, cabinMen, cabinWomen };
  }

  /** Demo data relative to today: weekly trainings, a match, club-wide events, one cancellation. */
  private seedAppointments(): Appointment[] {
    const clock = this.people.clock;
    const today = clock.today();
    const weekStart = ZonedClock.addDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7));
    const at = (offsetDays: number, time: string) => clock.toInstant(`${ZonedClock.addDays(weekStart, offsetDays)}T${time}`);
    const items: Appointment[] = [];
    let n = 0;
    type Seed = Omit<Appointment, 'id' | 'cancelled' | 'locationId' | 'cabinMen' | 'cabinWomen' | 'rides'> & Partial<Appointment>;
    const add = (a: Seed) =>
      items.push({ id: `a-${++n}`, cancelled: false, locationId: null, cabinMen: null, cabinWomen: null, rides: typeOf(a.type).rides, ...a, description: a.description ?? null, location: a.location ?? null });

    for (let week = -1; week < 6; week++) {
      const base = week * 7;
      for (const [day, series] of [[1, 's-damen-di'], [3, 's-damen-do']] as const) {
        add({ seriesId: series, teamId: 't-damen', type: 'TRAINING', title: 'Training Damen 1', description: null,
          location: 'Turnhalle Nord', locationId: 'l-nord', cabinWomen: 'Kabine 3', startsAt: at(base + day, '19:00'), endsAt: at(base + day, '21:00') });
      }
      add({ seriesId: 's-u16-mo', teamId: 't-u16', type: 'TRAINING', title: 'Training U16', description: null,
        location: 'Turnhalle Süd', locationId: 'l-sued', startsAt: at(base, '17:30'), endsAt: at(base, '19:00'), cancelled: week === 1 });
    }
    add({ seriesId: null, teamId: 't-damen', type: 'MATCH', title: 'Heimspiel gegen VC Musterstadt',
      description: 'Treffpunkt 60 Minuten vor Spielbeginn in der Halle.', location: 'Turnhalle Nord', locationId: 'l-nord',
      startsAt: at(12, '15:00'), endsAt: at(12, '17:30') });
    add({ seriesId: null, teamId: 't-u16', type: 'TOURNAMENT', title: 'U16 Landesturnier', description: null,
      location: 'Sportzentrum West', locationId: 'l-west', startsAt: at(19, '09:00'), endsAt: at(19, '18:00') });
    add({ seriesId: null, teamId: null, type: 'MEETING', title: 'Mitgliederversammlung',
      description: 'Tagesordnung:\n1. Bericht des Vorstands\n2. Kassenbericht\n3. Allfälliges', location: 'Vereinsheim', locationId: 'l-heim',
      startsAt: at(16, '19:30'), endsAt: at(16, '21:30') });
    add({ seriesId: null, teamId: null, type: 'EVENT', title: 'Saisonabschluss', description: null, location: 'Vereinsheim', locationId: 'l-heim',
      startsAt: at(26, '18:00'), endsAt: at(26, '23:00') });
    return items;
  }

  /** The home match needs equipment; one item and one file were deleted since. */
  private seedLinks() {
    const match = this.appointments.data.find((a) => a.type === 'MATCH');
    if (!match) return {};
    return {
      [match.id]: {
        needs: [
          { itemId: 'i-balls', name: 'Volleybälle Mikasa V200W', quantity: 12 },
          { itemId: 'i-net', name: 'Netz Wettkampf', quantity: 1 },
          { itemId: 'i-scoreboard', name: 'Anzeigetafel', quantity: 1 },
          { itemId: 'i-old-cart', name: 'Ballwagen alt', quantity: 1 },
        ],
        files: [
          { fileId: 'file-4', folderId: 'f-damen', name: 'Spielplan Herbst.xlsx' },
          { fileId: 'file-old', folderId: 'f-damen', name: 'Aufstellung Vorsaison.pdf' },
        ],
      },
    };
  }

  private seedRides(): StoredRide[] {
    const match = this.appointments.data.find((a) => a.type === 'MATCH' && Date.parse(a.startsAt) > Date.now() && !a.cancelled);
    return match ? [{ id: 'ride-1', appointmentId: match.id, driverId: 'trainer', seats: 3, note: 'Abfahrt 1 Stunde vorher bei der Halle', passengers: [] }] : [];
  }

  private seedResponses(): Record<string, Record<string, StoredResponse>> {
    const now = new Date().toISOString();
    const future = this.appointments.data.filter((a) => a.teamId === 't-damen' && Date.parse(a.startsAt) > Date.now() && !a.cancelled);
    const [first, second] = future;
    const responses: Record<string, Record<string, StoredResponse>> = {};
    if (first) {
      responses[first.id] = {
        trainer: { status: 'YES', reason: null, updatedAt: now },
        spielerin: { status: 'NO', reason: 'Arbeit bis 20 Uhr', updatedAt: now },
      };
    }
    if (second) responses[second.id] = { spielerin: { status: 'MAYBE', reason: null, updatedAt: now } };
    return responses;
  }
}

export const calendar = new MockCalendar(directory);

/** server: CalendarHandlers.listTypes, saveType, deleteType. */
export const appointmentTypes = {
  list(): { items: AppointmentTypeInfo[] } {
    const items = [...types.data].sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label));
    return { items: items.map((t) => ({ ...t, inUse: calendar.appointments.data.some((a) => a.type === t.key) })) };
  },

  save(member: Member, key: string | null, body: Record<string, any>): AppointmentTypeInfo {
    directory.requirePrivileged(member, ['ADMIN', 'BOARD']);
    if (key && !types.data.some((t) => t.key === key)) fail(404, 'appointment-type.not-found');
    const label = typeof body.label === 'string' ? body.label.trim() : '';
    if (!label || label.length > 40) fail(400, 'appointment-type.label-invalid');
    if (!HUES.includes(body.hue)) fail(400, 'appointment-type.hue-invalid');
    if (!Number.isInteger(body.sort) || body.sort < 0 || body.sort > 1000) fail(400, 'appointment-type.sort-invalid');
    const type: AppointmentTypeInfo = { key: key ?? `TYPE_${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`, label, hue: body.hue,
      rides: !!body.rides, cabins: !!body.cabins, sort: body.sort, archived: !!body.archived, inUse: false };
    const index = types.data.findIndex((t) => t.key === type.key);
    if (index >= 0) types.data[index] = type;
    else types.data.push(type);
    types.save();
    mockServer.events.publish({ type: 'calendar.appointment-types-changed', data: {} });
    return { ...type, inUse: calendar.appointments.data.some((a) => a.type === type.key) };
  },

  delete(member: Member, key: string): void {
    directory.requirePrivileged(member, ['ADMIN', 'BOARD']);
    const index = types.data.findIndex((t) => t.key === key);
    if (index < 0) fail(404, 'appointment-type.not-found');
    if (calendar.appointments.data.some((a) => a.type === key)) fail(409, 'appointment-type.in-use');
    types.data.splice(index, 1);
    types.save();
    mockServer.events.publish({ type: 'calendar.appointment-types-changed', data: {} });
  },
};

// server: CalendarModule.remindItemHolders runs every 15 minutes; the browser mock checks on start and then periodically.
if (typeof window !== 'undefined') {
  const remind = () => calendar.remindItemHolders(settings.inventory.reminderBeforeMs);
  setTimeout(remind, 0);
  setInterval(remind, settings.inventory.reminderCheckMs);
}

itemUseSources.push((member, itemId) => calendar.itemUses(member, itemId));

const actor = (req: MockRequest) => directory.actor(req);

mockServer
  .on('GET', '/api/v1/appointments/:id/activity', (req) => activity.list(actor(req), 'APPOINTMENT', calendar.visible(actor(req), req.params.id).id))
  .on('GET', '/api/v1/calendar/types', (req) => (directory.actor(req), appointmentTypes.list()))
  .on('POST', '/api/v1/calendar/types', (req) => appointmentTypes.save(directory.actor(req), null, req.body ?? {}))
  .on('PUT', '/api/v1/calendar/types/:key', (req) => appointmentTypes.save(directory.actor(req), req.params.key, req.body ?? {}))
  .on('DELETE', '/api/v1/calendar/types/:key', (req) => appointmentTypes.delete(directory.actor(req), req.params.key))
  .on('GET', '/api/v1/appointments', (req) =>
    ({ items: calendar.list(actor(req), req.query.get('from'), req.query.get('to'), req.query.get('teamId')) }))
  .on('POST', '/api/v1/appointments', (req) => ({ items: calendar.create(actor(req), req.body ?? {}) }))
  .on('GET', '/api/v1/appointments/:id', (req) => calendar.visible(actor(req), req.params.id))
  .on('PATCH', '/api/v1/appointments/:id', (req) => calendar.update(actor(req), req.params.id, req.body ?? {}))
  .on('POST', '/api/v1/appointments/:id/cancel', (req) =>
    ({ items: calendar.cancel(actor(req), req.params.id, req.query.get('includeFollowing') === 'true') }))
  .on('GET', '/api/v1/appointments/:id/links', (req) => calendar.getLinks(actor(req), req.params.id))
  .on('PUT', '/api/v1/appointments/:id/links', (req) => calendar.setLinks(actor(req), req.params.id, req.body ?? {}))
  .on('GET', '/api/v1/appointments/:id/attendance', (req) => calendar.overview(actor(req), req.params.id))
  .on('GET', '/api/v1/me/absences', (req) => ({ items: calendar.listAbsences(actor(req)) }))
  .on('POST', '/api/v1/me/absences', (req) => calendar.addAbsence(actor(req), req.body ?? {}))
  .on('DELETE', '/api/v1/me/absences/:id', (req) => calendar.deleteAbsence(actor(req), req.params.id))
  .on('GET', '/api/v1/appointments/:id/rides', (req) => ({ items: calendar.listRides(actor(req), req.params.id) }))
  .on('POST', '/api/v1/appointments/:id/rides', (req) => calendar.offerRide(actor(req), req.params.id, req.body ?? {}))
  .on('DELETE', '/api/v1/rides/:id', (req) => calendar.cancelRide(actor(req), req.params.id))
  .on('PUT', '/api/v1/rides/:id/passengers', (req) => calendar.joinRide(actor(req), req.params.id, req.body ?? {}))
  .on('DELETE', '/api/v1/rides/:id/passengers/:memberId', (req) => calendar.leaveRide(actor(req), req.params.id, req.params.memberId))
  .on('PUT', '/api/v1/appointments/:id/attendance', (req) => calendar.respond(actor(req), req.params.id, req.body ?? {}))
  .on('POST', '/api/v1/me/ical-token', (req) => calendar.issueFeed(actor(req)))
  .on('DELETE', '/api/v1/me/ical-token', (req) => calendar.revokeFeed(actor(req)));
