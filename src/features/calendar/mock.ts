// Mock of the club-server calendar and attendance modules (visibility, edit rights, series, answers).
import { generatedKey } from '../../lib/mock/keys';
import { activity, MockActivity } from '../../lib/mock/MockActivity';
import { settings } from '../../settings';
import { personalData, directory, MockDirectory } from '../../lib/mock/core';
import { EVERYONE, hasAudience, isChosen, NO_AUDIENCE, type Reach } from '../../lib/reach';
import type { MockAudience } from '../../lib/mock/MockEventBus';
import { itemUseSources, MockLinks, type ItemUse } from '../../lib/mock/MockLinks';
import { MockServer, mockServer, type MockRequest } from '../../lib/mock/MockServer';
import { MockTable } from '../../lib/mock/MockTable';
import { ZonedClock, type LocalDate } from '../../lib/time/ZonedClock';
import { repeatAt, type Rhythm } from '../../lib/time/repeat';
import { ADMIN_BOARD, coaches, type Member } from '../../lib/types';
import {
  HUES,
  SEEDED_APPOINTMENT_TYPES,
  type Absence,
  type AppointmentTypeInfo,
  type CalendarSettings,
  type Appointment,
  type AppointmentPatch,
  type Ride,
  type AppointmentType,
  type Attendance,
  type AttendanceEntry,
  type MemberStats,
  type Holiday,
  type Extras,
  type ExtrasInput,
  type MatchList,
  SET_PATTERN,
  type OpenAnswer,
  type TeamStats,
  type NewAppointment,
  type ResponseStatus,
} from './model';
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
  /** server: needs_confirmation — the time changed after a YES/MAYBE. */
  unconfirmed?: boolean;
}

/** server: attendance_absence.created_at — an absence entered after a YES counts as NO. */
type StoredAbsence = Absence & { createdAt?: string };

const fail = MockServer.fail;
const limits = settings.calendar;
const DAY_MS = 86_400_000;
/** server: calendar_type (`inUse` computed when listed). */
const types = new MockTable<AppointmentTypeInfo[]>('appointment-types', () => structuredClone([...SEEDED_APPOINTMENT_TYPES]));
const typeOf = (key: AppointmentType): AppointmentTypeInfo => types.data.find((t) => t.key === key) ?? fail(400, 'appointment.type-unknown');
/** server: calendar_setting (V135). */
const calendarSettings = new MockTable<CalendarSettings>('calendar-settings', () => ({
  cabinLabels: ['Herren', 'Damen'],
  itemRemindHours: 24,
  openAnswerDays: 14,
  maxRideSeats: 8,
}));
/** server: CalendarHandlers.requireCabinLabels */
const requireCabinLabels = (cabins: string[]) => {
  if (cabins.length > calendarSettings.data.cabinLabels.length) fail(400, 'appointment.cabin-not-allowed');
};
const STATUSES: readonly ResponseStatus[] = ['YES', 'NO', 'MAYBE'];

export class MockCalendar {
  readonly appointments: MockTable<Appointment[]>;
  /** appointmentId → memberId → answer */
  readonly responses: MockTable<Record<string, Record<string, StoredResponse>>>;
  /** memberId → feed token */
  readonly feeds = new MockTable<Record<string, string>>('ical', () => ({}));
  /** server: attendance_absence */
  readonly absences = new MockTable<StoredAbsence[]>('absences', () => []);
  /** server: attendance_presence — appointmentId → memberId → present */
  readonly presence = new MockTable<Record<string, Record<string, boolean>>>('attendance-presence', () => ({}));
  /** server: calendar_holiday */
  readonly holidays = new MockTable<Holiday[]>('holidays', () => []);
  /** server: calendar_series — seriesId → weeks between occurrences */
  readonly intervals = new MockTable<Record<string, Rhythm>>('series-intervals', () => ({}));
  /** server: calendar_extra — training plan; opponent, home/away, sets */
  readonly extrasTable = new MockTable<Record<string, ExtrasInput>>('appointment-extras', () => ({}));
  /** server: attendance_reminder — appointments whose open answers were reminded */
  readonly openReminded = new MockTable<string[]>('attendance-reminded', () => []);
  readonly rides: MockTable<StoredRide[]>;

  constructor(private readonly people: MockDirectory) {
    this.appointments = new MockTable('appointments', () => this.seedAppointments());
    this.responses = new MockTable('responses', () => this.seedResponses());
    this.rides = new MockTable('rides', () => this.seedRides());
    this.links = new MockLinks('calendar-links', () => this.seedLinks());
    this.reminded = new MockTable<string[]>('need-reminders', () => []);
    mockServer.events.subscribe((event) => event.type === 'locations.location-changed' && this.onLocationChanged(event.data as never));
    mockServer.events.subscribe(
      (event) => event.type === 'members.member-erased' && this.onMemberErased((event.data as { memberId: string }).memberId),
    );
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
    return this.links
      .owners(itemId)
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
    this.requireMayEdit(member, appointment);
    const links = this.links.set(member, appointment.id, body);
    this.changed(member, [appointment], 'UPDATED');
    MockActivity.record('APPOINTMENT', appointment.id, member, 'UPDATED', {
      title: appointment.title,
      teamIds: appointment.teamId ? [appointment.teamId] : [],
    });
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
    // server: CalendarHandlers.create — no team and no chosen entries = the whole club
    const chosen = MockDirectory.parseReach(body.audience, 'appointment.audience-invalid');
    const audience = body.teamId || hasAudience(chosen) ? chosen : EVERYONE;
    this.requireMayEdit(member, { teamId: body.teamId ?? null, audience, createdBy: member.id });
    if (typeOf(body.type).archived) fail(400, 'appointment.type-archived');
    const rides = body.rides ?? typeOf(body.type).rides;
    const first = MockCalendar.validated(
      this.placed({ ...body, id: '', seriesId: null, cancelled: false, rides, audience, createdBy: member.id }, body.locationId ?? null),
    );
    requireCabinLabels(first.cabins);
    const rhythm = body.repeatUntil ? MockCalendar.rhythm(body.intervalWeeks, body.intervalMonths, body.byWeekday) : null;
    const local = this.people.clock.toLocal(first.startsAt);
    if (rhythm && (!/^\d{4}-\d{2}-\d{2}$/.test(body.repeatUntil!) || body.repeatUntil! < local.slice(0, 10)))
      fail(400, 'appointment.repeat-until-invalid');
    const starts = rhythm ? this.seriesStarts(local, rhythm, 0, body.repeatUntil!) : [first.startsAt];
    const seriesId = rhythm ? crypto.randomUUID() : null;
    if (seriesId) {
      this.intervals.data[seriesId] = rhythm!;
      this.intervals.save();
    }
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

  /** server: CalendarHandlers.update — with includeFollowing the later occurrences change alike (times shift by as much). */
  update(member: Member, id: string, patch: AppointmentPatch): Appointment {
    const current = this.visible(member, id);
    this.requireMayEdit(member, current);
    const before = { ...current };
    const { clearLocationId, includeFollowing, audience, ...rest } = patch;
    const defined: Partial<Appointment> = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== null && v !== undefined));
    if (audience != null) defined.audience = MockDirectory.parseReach(audience, 'appointment.audience-invalid');
    const apply = (a: Appointment, startsAt: string, endsAt: string) => {
      const merged = { ...a, ...defined, startsAt, endsAt };
      return MockCalendar.validated(clearLocationId ? { ...merged, locationId: null } : this.placed(merged, patch.locationId ?? null));
    };
    const next = apply(current, patch.startsAt ?? current.startsAt, patch.endsAt ?? current.endsAt);
    this.requireMayEdit(member, next); // a coach keeps it for chosen people
    if (patch.cabins) requireCabinLabels(next.cabins);
    const startShift = Date.parse(next.startsAt) - Date.parse(before.startsAt);
    const endShift = Date.parse(next.endsAt) - Date.parse(before.endsAt);
    const later =
      includeFollowing && current.seriesId
        ? this.appointments.data.filter((a) => a.seriesId === current.seriesId && a.id !== current.id && a.startsAt > before.startsAt && !a.cancelled)
        : [];
    Object.assign(current, next);
    for (const a of later) {
      Object.assign(
        a,
        apply(a, new Date(Date.parse(a.startsAt) + startShift).toISOString(), new Date(Date.parse(a.endsAt) + endShift).toISOString()),
      );
    }
    this.appointments.save();
    const all = [current, ...later];
    const upcoming = Date.parse(before.endsAt) > Date.now() && !before.cancelled;
    // server: AppointmentType.moved — announced only with notifyChanges and beyond the type's minimum shift
    const rule = typeOf(current.type);
    const min = rule.minShiftMinutes * 60_000;
    const moved = upcoming && rule.notifyChanges && (Math.abs(startShift) > min || Math.abs(endShift) > min);
    const placeChanged =
      upcoming && rule.notifyChanges && (before.location !== current.location || before.cabins.join('\n') !== current.cabins.join('\n'));
    if (moved) {
      // server: AttendanceHandlers — YES and MAYBE wait for a confirmation
      for (const a of all) for (const r of Object.values(this.responses.data[a.id] ?? {})) if (r.status !== 'NO') r.unconfirmed = true;
      this.responses.save();
    }
    this.changed(member, all, 'UPDATED', { moved, placeChanged, previousStartsAt: before.startsAt });
    MockActivity.record('APPOINTMENT', current.id, member, 'UPDATED', { title: current.title, teamIds: current.teamId ? [current.teamId] : [] });
    return current;
  }

  cancel(member: Member, id: string, includeFollowing: boolean, rawReason: string | null = null): Appointment[] {
    const current = this.visible(member, id);
    this.requireMayEdit(member, current);
    const targets =
      includeFollowing && current.seriesId
        ? this.appointments.data.filter((a) => a.seriesId === current.seriesId && a.startsAt >= current.startsAt && !a.cancelled)
        : [current];
    return this.cancelAll(member, targets, MockCalendar.reason(rawReason));
  }

  private cancelAll(member: Member, targets: Appointment[], reason: string | null): Appointment[] {
    targets.forEach((a) => Object.assign(a, { cancelled: true, cancelReason: reason }));
    this.appointments.save();
    this.changed(member, targets, 'CANCELLED', { reason });
    targets.forEach((a) => MockActivity.record('APPOINTMENT', a.id, member, 'CANCELLED', { title: a.title, teamIds: a.teamId ? [a.teamId] : [] }));
    return targets;
  }

  private static reason(raw: string | null | undefined): string | null {
    const reason = raw?.trim() || null;
    if ((reason?.length ?? 0) > 300) fail(400, 'appointment.reason-too-long');
    return reason;
  }

  /** server: CalendarHandlers.cancelRange — a team's (or the club-wide) appointments on these days. */
  cancelRange(member: Member, body: { teamId?: string | null; from?: string; to?: string; reason?: string | null }): Appointment[] {
    const teamId = body.teamId ?? null;
    if (!body.from || !body.to || body.to < body.from) fail(400, 'calendar.range-invalid');
    this.requireMayEdit(member, { teamId, audience: teamId ? NO_AUDIENCE : EVERYONE, createdBy: null });
    const clock = this.people.clock;
    const from = clock.toInstant(`${body.from}T00:00`);
    const to = clock.toInstant(`${ZonedClock.addDays(body.to!, 1)}T00:00`);
    const targets = this.appointments.data.filter((a) => a.teamId === teamId && !a.cancelled && a.startsAt >= from && a.startsAt < to);
    return this.cancelAll(member, targets, MockCalendar.reason(body.reason));
  }

  /** server: CalendarHandlers.restore */
  restore(member: Member, id: string): Appointment {
    const current = this.visible(member, id);
    this.requireMayEdit(member, current);
    if (!current.cancelled) return current;
    Object.assign(current, { cancelled: false, cancelReason: null });
    this.appointments.save();
    this.changed(member, [current], 'RESTORED');
    return current;
  }

  /** server: CalendarHandlers.delete — only while nobody answered. */
  delete(member: Member, id: string): void {
    const current = this.visible(member, id);
    this.requireMayEdit(member, current);
    if (Object.keys(this.responses.data[id] ?? {}).length) fail(409, 'appointment.has-answers');
    this.appointments.data.splice(this.appointments.data.indexOf(current), 1);
    this.appointments.save();
    this.changed(member, [current], 'CANCELLED', { silent: true });
  }

  private static extrasOf(id: string, x: ExtrasInput | undefined): Extras {
    const e = x ?? { content: null, opponent: null, home: null, sets: [] };
    let setsWon = 0;
    let setsLost = 0;
    for (const set of e.sets) {
      const [ours, theirs] = set.split(':').map(Number);
      if (ours > theirs) setsWon++;
      else if (theirs > ours) setsLost++;
    }
    return { appointmentId: id, ...e, setsWon, setsLost, won: e.sets.length ? setsWon > setsLost : null };
  }

  /** server: CalendarHandlers extras — read by who sees it, written by who may edit it. */
  extras(member: Member, id: string): Extras {
    return MockCalendar.extrasOf(id, this.extrasTable.data[this.visible(member, id).id]);
  }

  setExtras(member: Member, id: string, body: Record<string, any>): Extras {
    const appointment = this.visible(member, id);
    this.requireMayEdit(member, appointment);
    const content = typeof body.content === 'string' && body.content.trim() ? body.content.trim() : null;
    const opponent = typeof body.opponent === 'string' && body.opponent.trim() ? body.opponent.trim() : null;
    const sets: string[] = (Array.isArray(body.sets) ? body.sets : []).map((s: string) => String(s).trim()).filter(Boolean);
    if ((content?.length ?? 0) > 4000 || (opponent?.length ?? 0) > 80 || sets.length > 5 || sets.some((s) => !SET_PATTERN.test(s)))
      fail(400, 'appointment.extras-invalid');
    const extra: ExtrasInput = { content, opponent, home: typeof body.home === 'boolean' ? body.home : null, sets };
    this.extrasTable.data[id] = extra;
    this.extrasTable.save();
    this.changed(member, [appointment], 'UPDATED');
    return MockCalendar.extrasOf(id, extra);
  }

  /** server: CalendarHandlers.teamMatches */
  teamMatches(member: Member, teamId: string, from: string | null, to: string | null): MatchList {
    const items = this.list(member, from, to, teamId)
      .filter((a) => !a.cancelled && a.teamId === teamId)
      .flatMap((a) => {
        const x = this.extrasTable.data[a.id];
        if (!x || (!x.opponent && !x.sets.length)) return [];
        const e = MockCalendar.extrasOf(a.id, x);
        return [
          {
            appointmentId: a.id,
            title: a.title,
            startsAt: a.startsAt,
            opponent: e.opponent,
            home: e.home,
            sets: e.sets,
            setsWon: e.setsWon,
            setsLost: e.setsLost,
            won: e.won,
          },
        ];
      })
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return { items, won: items.filter((m) => m.won === true).length, lost: items.filter((m) => m.won === false).length };
  }

  /** server: CalendarHandlers.saveHoliday / deleteHoliday (admin/board) */
  saveHoliday(member: Member, id: string | null, body: Record<string, any>): Holiday {
    this.people.requirePrivileged(member, ['ADMIN', 'BOARD']);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const date = /^\d{4}-\d{2}-\d{2}$/;
    if (!name || name.length > 80 || !date.test(body.from) || !date.test(body.to) || body.to < body.from) fail(400, 'holiday.invalid');
    const holiday: Holiday = { id: id ?? crypto.randomUUID(), name, from: body.from, to: body.to };
    const index = this.holidays.data.findIndex((h) => h.id === id);
    if (id && index < 0) fail(404, 'holiday.not-found');
    if (index >= 0) this.holidays.data[index] = holiday;
    else this.holidays.data.push(holiday);
    this.holidays.data.sort((a, b) => a.from.localeCompare(b.from));
    this.holidays.save();
    return holiday;
  }

  deleteHoliday(member: Member, id: string): void {
    this.people.requirePrivileged(member, ['ADMIN', 'BOARD']);
    const index = this.holidays.data.findIndex((h) => h.id === id);
    if (index < 0) fail(404, 'holiday.not-found');
    this.holidays.data.splice(index, 1);
    this.holidays.save();
  }

  /** server: CalendarHandlers.extend — after the last occurrence, in the stored rhythm, with the last one's details. */
  extend(member: Member, id: string, repeatUntil: string | undefined): Appointment[] {
    const any = this.visible(member, id);
    this.requireMayEdit(member, any);
    if (!any.seriesId) fail(400, 'appointment.not-a-series');
    const series = this.appointments.data.filter((a) => a.seriesId === any.seriesId).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const last = series[series.length - 1];
    const rhythm = this.intervals.data[any.seriesId!] ?? { weeks: 1, months: 0, byWeekday: false };
    const local = this.people.clock.toLocal(last.startsAt);
    if (!repeatUntil || repeatUntil < repeatAt(local, rhythm, 1).slice(0, 10)) fail(400, 'appointment.repeat-until-invalid');
    const duration = Date.parse(last.endsAt) - Date.parse(last.startsAt);
    const added: Appointment[] = this.seriesStarts(local, rhythm, 1, repeatUntil!).map((startsAt) => ({
      ...last,
      id: crypto.randomUUID(),
      cancelled: false,
      cancelReason: null,
      startsAt,
      endsAt: new Date(Date.parse(startsAt) + duration).toISOString(),
    }));
    this.appointments.data.push(...added);
    this.appointments.save();
    this.changed(member, added, 'CREATED');
    return added;
  }

  /** server: AttendanceHandlers.myAnswers — own and the minors' answers to what the member sees. */
  myAnswers(member: Member, from: string | null, to: string | null): { appointmentId: string; memberId: string; status: ResponseStatus }[] {
    const people = new Set([member.id, ...this.people.wardsOf(member.id)]);
    return this.list(member, from, to, null).flatMap((a) =>
      Object.entries(this.responses.data[a.id] ?? {})
        .filter(([id]) => people.has(id))
        .map(([memberId, r]) => ({ appointmentId: a.id, memberId, status: r.status })),
    );
  }

  /** server: AttendanceHandlers.requireRunsTeam */
  private requireRunsTeam(member: Member, teamId: string | null): void {
    if (!this.runsTeam(member, teamId)) fail(403, 'access.denied');
  }

  private runsTeam(member: Member, teamId: string | null): boolean {
    return this.people.isManager(member) || (!!teamId && coaches(this.people.teamRoles(member.id)[teamId]));
  }

  /** server: AttendanceHandlers.runs — who runs the team, or the coach who made an appointment for chosen people. */
  private runs(member: Member, a: Appointment): boolean {
    return this.runsTeam(member, a.teamId) || (isChosen(a.audience) && member.roles.includes('COACH') && a.createdBy === member.id);
  }

  /** Players (club-wide CLUB: every member; chosen: the reach) expected to answer. */
  private players(a: Appointment): string[] {
    const teamId = a.teamId;
    if (teamId) return this.people.teamMembers(teamId).filter((id) => !coaches(this.people.teamRoles(id)[teamId]));
    return isChosen(a.audience) ? this.people.reachPool(a.audience) : this.people.audienceIds({ everyone: true });
  }

  /** server: an appointment expects answers — team ones and chosen ones unless NONE, club-wide ones with CLUB. */
  private static expects(a: Appointment): boolean {
    const expect = typeOf(a.type).expectAnswers;
    return a.teamId || isChosen(a.audience) ? expect !== 'NONE' : expect === 'CLUB';
  }

  private coachesOf(teamId: string): string[] {
    return this.people.teamMembers(teamId).filter((id) => coaches(this.people.teamRoles(id)[teamId]));
  }

  private absentOn(memberId: string, startsAt: string): StoredAbsence | undefined {
    const day = this.people.clock.localDate(startsAt);
    return this.absences.data.find((a) => a.memberId === memberId && a.from <= day && day <= a.to);
  }

  /** server: no answer, or a YES/MAYBE given before the absence was entered. */
  private static overrules(absence: StoredAbsence, answer: StoredResponse | undefined): boolean {
    return !answer || (answer.status !== 'NO' && !!absence.createdAt && absence.createdAt > answer.updatedAt);
  }

  private notice(kind: string, recipients: string[], a: Appointment, name: string | null = null): void {
    if (!recipients.length) return;
    mockServer.events.publish({
      type: 'attendance.notice',
      data: { kind, recipients, appointmentId: a.id, title: a.title, startsAt: a.startsAt, name },
    });
  }

  /** server: AttendanceHandlers.remindOpen — counts as the first reminder. */
  remindOpen(member: Member, id: string): number {
    const appointment = this.open(member, id);
    if (!this.runs(member, appointment)) fail(403, 'access.denied');
    const expect = typeOf(appointment.type).expectAnswers;
    if (expect === 'NONE') fail(400, 'attendance.answers-off');
    if (!MockCalendar.expects(appointment)) fail(400, 'attendance.not-a-team-appointment');
    return this.remind(appointment, 1);
  }

  /** server: AttendanceHandlers.remind — players (club-wide CLUB: every member) without an answer and not absent, plus their guardians. */
  private remind(appointment: Appointment, round: 1 | 2): number {
    // server: attendance_reminder per appointment and round; round 1 is stored as the bare id
    const key = round === 1 ? appointment.id : `${appointment.id}:2`;
    if (this.openReminded.data.includes(key)) return 0;
    this.openReminded.data.push(key);
    this.openReminded.save();
    const answers = this.responses.data[appointment.id] ?? {};
    const open = this.players(appointment).filter((id) => !answers[id] && !this.absentOn(id, appointment.startsAt));
    this.notice('OPEN_REMINDER', [...open, ...this.people.guardiansOf(open)], appointment);
    return open.length;
  }

  /** server: AttendanceModule.remindOpenAnswers — the type's reminder hours before the start, and again closer to it. */
  remindDue(): void {
    const now = Date.now();
    for (const a of this.appointments.data) {
      const type = types.data.find((t) => t.key === a.type);
      const start = Date.parse(a.startsAt);
      if (!type?.remindHours || !MockCalendar.expects(a)) continue;
      if (a.cancelled || start <= now) continue;
      if (type.remindAgainHours && start - type.remindAgainHours * 3_600_000 <= now) this.remind(a, 2);
      else if (start - type.remindHours * 3_600_000 <= now) this.remind(a, 1);
    }
  }

  /** server: CalendarHandlers GET_SETTINGS / SAVE_SETTINGS (admin/board). */
  settings(): CalendarSettings {
    return structuredClone(calendarSettings.data);
  }

  saveSettings(member: Member, body: Partial<CalendarSettings>): CalendarSettings {
    this.people.requirePrivileged(member, ['ADMIN', 'BOARD']);
    const labels = Array.isArray(body.cabinLabels) ? body.cabinLabels.map((l) => String(l ?? '').trim()) : null;
    const whole = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
    if (
      !labels ||
      labels.length > 4 ||
      labels.some((l) => !l || l.length > 40) ||
      !whole(body.itemRemindHours, 1, 336) ||
      !whole(body.openAnswerDays, 7, 60) ||
      !whole(body.maxRideSeats, 1, 50)
    ) {
      fail(400, 'calendar-settings.invalid');
    }
    Object.assign(calendarSettings.data, {
      cabinLabels: labels,
      itemRemindHours: body.itemRemindHours,
      openAnswerDays: body.openAnswerDays,
      maxRideSeats: body.maxRideSeats,
    });
    calendarSettings.save();
    return this.settings();
  }

  /** server: AttendanceHandlers.openAnswers — the club's openAnswerDays ahead, oneself and one's minors. */
  openAnswers(member: Member): { items: OpenAnswer[] } {
    const people = [member.id, ...this.people.wardsOf(member.id)];
    const now = Date.now();
    const items: OpenAnswer[] = [];
    for (const a of this.appointments.data) {
      const start = Date.parse(a.startsAt);
      if (
        a.cancelled ||
        !MockCalendar.expects(a) ||
        start <= now ||
        start > now + calendarSettings.data.openAnswerDays * DAY_MS ||
        !this.canSee(member, a)
      )
        continue;
      for (const id of people) {
        if (!this.involved(a, id) || this.responses.data[a.id]?.[id] || this.absentOn(id, a.startsAt)) continue;
        items.push({
          appointmentId: a.id,
          teamId: a.teamId,
          title: a.title,
          startsAt: a.startsAt,
          memberId: id,
          name: this.people.name(id) ?? 'Mitglied',
        });
      }
    }
    return { items: items.sort((x, y) => x.startsAt.localeCompare(y.startsAt) || x.name.localeCompare(y.name)) };
  }

  /** server: AttendanceHandlers.setPresence — once it started, by who runs the team; with self check-in by the member or a guardian until the end. */
  setPresence(member: Member, id: string, body: { memberId?: string; present?: boolean | null }): Attendance {
    const appointment = this.visible(member, id);
    if (!this.runs(member, appointment)) {
      if (!typeOf(appointment.type).selfCheckIn) fail(403, 'access.denied');
      if (body.memberId !== member.id && !this.people.wardsOf(member.id).includes(body.memberId ?? '')) fail(404, 'member.not-found');
      if (Date.parse(appointment.endsAt) <= Date.now()) fail(409, 'attendance.check-in-closed');
    }
    if (appointment.cancelled || Date.parse(appointment.startsAt) > Date.now()) fail(409, 'attendance.presence-not-yet');
    if (!body.memberId) fail(400, 'request.invalid');
    if (!this.involved(appointment, body.memberId!)) fail(403, 'attendance.not-in-team');
    const marks = (this.presence.data[id] ??= {});
    if (body.present == null) delete marks[body.memberId!];
    else marks[body.memberId!] = body.present;
    this.presence.save();
    return this.overview(member, id);
  }

  /** server: AttendanceHandlers.teamStats */
  teamStats(member: Member, teamId: string, from: string | null, to: string | null): TeamStats {
    this.requireRunsTeam(member, teamId);
    if (!from || !to || to < from) fail(400, 'calendar.range-invalid');
    const clock = this.people.clock;
    const start = clock.toInstant(`${from}T00:00`);
    const end = clock.toInstant(`${ZonedClock.addDays(to!, 1)}T00:00`);
    const now = new Date().toISOString();
    const held = this.appointments.data.filter(
      (a) => a.teamId === teamId && !a.cancelled && a.startsAt >= start && a.startsAt < end && a.startsAt < now,
    );
    const players = this.people.teamMembers(teamId).filter((id) => !coaches(this.people.teamRoles(id)[teamId]));
    const items: MemberStats[] = players
      .flatMap((id) => {
        const name = this.people.name(id);
        if (!name) return [];
        let yes = 0;
        let no = 0;
        let present = 0;
        let marked = 0;
        for (const a of held) {
          const answer = this.responses.data[a.id]?.[id];
          const away = this.absentOn(id, a.startsAt);
          if ((away && MockCalendar.overrules(away, answer)) || answer?.status === 'NO') no++;
          else if (answer?.status === 'YES') yes++;
          const mark = this.presence.data[a.id]?.[id];
          if (mark !== undefined) {
            marked++;
            if (mark) present++;
          }
        }
        return [{ memberId: id, name, appointments: held.length, yes, no, present, marked }];
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    return { teamId, from: from!, to: to!, appointments: held.length, items };
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
    if (!this.involved(appointment, target)) fail(403, 'attendance.not-in-team');
    const type = typeOf(appointment.type);
    if (type.expectAnswers === 'NONE') fail(400, 'attendance.answers-off');
    if (Date.parse(appointment.startsAt) - type.answerDeadlineHours * 3_600_000 <= Date.now()) fail(409, 'attendance.deadline-passed');
    if (body.status === 'MAYBE' && !type.allowMaybe) fail(400, 'attendance.maybe-off');
    if (body.status === 'NO' && type.reasonOnNo && !body.reason?.trim()) fail(400, 'attendance.reason-required');
    const response: StoredResponse = {
      status: body.status as ResponseStatus,
      reason: body.reason?.trim() || null,
      updatedAt: new Date().toISOString(),
      unconfirmed: false,
    };
    (this.responses.data[id] ??= {})[target] = response;
    this.responses.save();
    mockServer.events.publish({
      type: 'attendance.response-changed',
      data: { appointmentId: id, memberId: target, status: response.status },
      audience: this.audienceOf(appointment),
    });
    return { appointmentId: id, memberId: target, status: response.status, reason: response.reason, updatedAt: response.updatedAt };
  }

  /** server: AttendanceHandlers.overview */
  overview(member: Member, id: string): Attendance {
    const appointment = this.visible(member, id);
    const answers = this.responses.data[id] ?? {};
    const expected = new Set(Object.keys(answers));
    if (appointment.teamId) this.people.teamMembers(appointment.teamId).forEach((m) => expected.add(m));
    else if (isChosen(appointment.audience)) this.people.reachPool(appointment.audience).forEach((m) => expected.add(m));
    else if (typeOf(appointment.type).expectAnswers === 'CLUB') this.people.audienceIds({ everyone: true }).forEach((m) => expected.add(m));
    // server: an absence on the appointment's local day counts as NO until the member answers.
    const day = this.people.clock.localDate(appointment.startsAt);
    const showReasons = this.runs(member, appointment);
    const own = [member.id, ...this.people.wardsOf(member.id)];
    const entries: AttendanceEntry[] = [...expected]
      .flatMap((memberId): AttendanceEntry[] => {
        const name = this.people.name(memberId);
        if (!name) return [];
        const answer = answers[memberId];
        const found = this.absences.data.find((a) => a.memberId === memberId && a.from <= day && day <= a.to);
        const away = found && MockCalendar.overrules(found, answer) ? found : undefined;
        // server: everyone's presence for who sees reasons, otherwise one's own and one's minors'
        const present = showReasons || own.includes(memberId) ? (this.presence.data[id]?.[memberId] ?? null) : null;
        if (away) {
          return [
            {
              memberId,
              name,
              status: 'NO' as const,
              reason: showReasons ? (away.reason ? `Abwesend: ${away.reason}` : 'Abwesend') : null,
              updatedAt: null,
              absent: true,
              unconfirmed: false,
              present,
            },
          ];
        }
        return [
          {
            memberId,
            name,
            status: answer?.status ?? null,
            reason: showReasons ? (answer?.reason ?? null) : null,
            updatedAt: answer?.updatedAt ?? null,
            absent: false,
            unconfirmed: !!answer?.unconfirmed,
            present,
          },
        ];
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
    this.requireNoOverlap(target, body.from!, body.to!);
    const createdAt = new Date().toISOString();
    const absence: StoredAbsence = {
      id: crypto.randomUUID(),
      memberId: target,
      from: body.from!,
      to: body.to!,
      reason: body.reason?.trim() || null,
      createdAt,
    };
    this.absences.data.push(absence);
    this.absences.save();
    // server: AttendanceHandlers.addAbsence — a YES in the absence tells the team's coaches
    const name = this.people.name(target) ?? 'Mitglied';
    for (const a of this.appointments.data) {
      const day = this.people.clock.localDate(a.startsAt);
      if (a.cancelled || !a.teamId || a.startsAt < createdAt || day < absence.from || day > absence.to) continue;
      if (this.responses.data[a.id]?.[target]?.status === 'YES') this.notice('ABSENT_AFTER_YES', this.coachesOf(a.teamId), a, name);
    }
    const { createdAt: _createdAt, ...dto } = absence;
    return dto;
  }

  listAbsences(member: Member, of: string | null = null): Absence[] {
    // server: with memberId, for self, guardians, coaches of the member's teams, admin and board.
    if (of && !this.people.mayOpen(member, of)) fail(404, 'member.not-found');
    const mine = new Set(of ? [of] : [member.id, ...this.people.wardsOf(member.id)]);
    const today = this.people.clock.today();
    return this.absences.data
      .filter((a) => mine.has(a.memberId) && a.to >= today)
      .sort((a, b) => a.from.localeCompare(b.from))
      .map(({ createdAt: _createdAt, ...a }) => a);
  }

  /** server: AttendanceHandlers.calendarMove — the member or a guardian moves the absence. */
  moveAbsence(member: Member, id: string, from: string, to: string): void {
    const absence = this.absences.data.find((a) => a.id === id);
    if (!absence || (absence.memberId !== member.id && !this.people.wardsOf(member.id).includes(absence.memberId))) fail(404, 'absence.not-found');
    if (to < from) fail(400, 'absence.range-invalid');
    this.requireNoOverlap(absence!.memberId, from, to, id);
    Object.assign(absence!, { from, to });
    this.absences.save();
  }

  /** server: AttendanceHandlers.requireNoOverlap — one absence per member and day. */
  private requireNoOverlap(memberId: string, from: string, to: string, except?: string): void {
    if (this.absences.data.some((a) => a.memberId === memberId && a.id !== except && a.to >= from && a.from <= to)) fail(409, 'absence.overlaps');
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
    if (!Number.isInteger(seats) || seats < 1 || seats > calendarSettings.data.maxRideSeats) fail(400, 'ride.seats-invalid');
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
    if (!appointment.rides) fail(409, 'ride.not-offered');
  }

  cancelRide(member: Member, rideId: string): void {
    const ride = this.ride(member, rideId);
    if (ride.driverId !== member.id && !this.people.isManager(member)) fail(403, 'ride.not-driver');
    this.rides.data.splice(this.rides.data.indexOf(ride), 1);
    const appointment = this.visible(member, ride.appointmentId);
    this.ridesChanged(appointment);
    this.notice('RIDE_CANCELLED', [...ride.passengers, ...this.people.guardiansOf(ride.passengers)], appointment, this.people.name(ride.driverId));
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
    const joined = !ride.passengers.includes(target);
    all.forEach((r) => (r.passengers = r.passengers.filter((p) => p !== target)));
    ride.passengers.push(target);
    this.ridesChanged(appointment);
    if (joined) this.notice('RIDE_JOINED', [ride.driverId], appointment, this.people.name(target));
    return this.rideDto(ride);
  }

  leaveRide(member: Member, rideId: string, memberId: string): Ride {
    const ride = this.ride(member, rideId);
    const allowed =
      memberId === member.id || ride.driverId === member.id || this.people.isManager(member) || this.people.wardsOf(member.id).includes(memberId);
    if (!allowed) fail(403, 'ride.not-passenger');
    const left = ride.passengers.includes(memberId);
    ride.passengers = ride.passengers.filter((p) => p !== memberId);
    const appointment = this.visible(member, ride.appointmentId);
    this.ridesChanged(appointment);
    if (left && ride.driverId !== member.id) this.notice('RIDE_LEFT', [ride.driverId], appointment, this.people.name(memberId));
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
      audience: this.audienceOf(appointment),
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
  private changed(
    actor: Member,
    appointments: readonly Appointment[],
    change: 'CREATED' | 'UPDATED' | 'CANCELLED' | 'RESTORED',
    extra: { moved?: boolean; placeChanged?: boolean; reason?: string | null; previousStartsAt?: string; silent?: boolean } = {},
  ): void {
    const [first] = appointments;
    if (!first) return;
    mockServer.events.publish({
      type: 'calendar.appointments-changed',
      data: {
        appointmentIds: appointments.map((a) => a.id),
        teamId: first.teamId,
        change,
        actorId: actor.id,
        title: first.title,
        firstStartsAt: first.startsAt,
        ...extra,
      },
      audience: this.audienceOf(first),
    });
  }

  /** server: CalendarHandlers.publish — the team; the whole club; or for chosen people the reach, their guardians, the creator and admin/board. */
  private audienceOf(a: Appointment): MockAudience {
    if (!isChosen(a.audience)) return this.people.teamAudience(a.teamId);
    const pool = this.people.reachPool(a.audience);
    return { members: [...pool, ...this.people.guardiansOf(pool), ...(a.createdBy ? [a.createdBy] : [])], roles: ADMIN_BOARD };
  }

  /** server: CalendarHandlers.Viewer.canSee — chosen ones by the reach of the member or a minor, or as their creator. */
  private canSee(member: Member, appointment: Appointment): boolean {
    if (this.people.isManager(member)) return true;
    if (appointment.teamId) return this.people.visibleTeamIds(member.id).has(appointment.teamId);
    if (!isChosen(appointment.audience)) return true;
    return (
      appointment.createdBy === member.id ||
      [member.id, ...this.people.wardsOf(member.id)].some((id) => this.people.reaches(appointment.audience, id))
    );
  }

  /** server: CalendarHandlers.mayEdit — the board; coaches of the team; a coach the appointment for chosen people they made. */
  mayEdit(member: Member, a: Pick<Appointment, 'teamId' | 'audience' | 'createdBy'>): boolean {
    if (this.people.isManager(member)) return true;
    if (a.teamId) return coaches(this.people.teamRoles(member.id)[a.teamId]);
    return isChosen(a.audience) && member.roles.includes('COACH') && a.createdBy === member.id;
  }

  /** server: CalendarHandlers.requireMayEdit — the whole club needs admin/board. */
  private requireMayEdit(member: Member, a: Pick<Appointment, 'teamId' | 'audience' | 'createdBy'>): void {
    if (a.teamId === null && !isChosen(a.audience)) this.people.requirePrivileged(member, ['ADMIN', 'BOARD']);
    else if (!this.mayEdit(member, a)) fail(403, 'access.denied');
  }

  /** Who is expected to answer: the team, or for chosen people the reach (server: AttendanceHandlers). */
  private involved(a: Appointment, memberId: string): boolean {
    if (a.teamId) return a.teamId in this.people.teamRoles(memberId);
    return !isChosen(a.audience) || this.people.reaches(a.audience, memberId);
  }

  /** server: Series.rhythm — weeks (default 1, up to 8) or months (1–12, by date or weekday), not both. */
  private static rhythm(weeks: number | null | undefined, months: number | null | undefined, byWeekday: boolean | undefined): Rhythm {
    const ok = (n: number, max: number) => Number.isInteger(n) && n >= 1 && n <= max;
    if (months == null) {
      if (!ok(weeks ?? 1, limits.maxIntervalWeeks)) fail(400, 'appointment.interval-invalid');
      return { weeks: weeks ?? 1, months: 0, byWeekday: false };
    }
    if (weeks != null || !ok(months, limits.maxIntervalMonths)) fail(400, 'appointment.interval-invalid');
    return { weeks: 0, months, byWeekday: byWeekday === true };
  }

  /** server: Series.expand — start instants from the i-th step on, same wall-clock time (across DST), skipping the club's holidays. */
  private seriesStarts(anchor: string, rhythm: Rhythm, from: number, repeatUntil: LocalDate): string[] {
    const starts: string[] = [];
    for (let i = from; ; i++) {
      const at = repeatAt(anchor, rhythm, i);
      const date = at.slice(0, 10);
      if (date > repeatUntil) return starts;
      if (starts.length === limits.maxSeriesOccurrences) fail(400, 'appointment.series-too-long');
      if (this.holidays.data.some((h) => h.from <= date && date <= h.to)) continue;
      starts.push(this.people.clock.toInstant(at));
    }
  }

  /** server: CalendarHandlers.remindItemHolders - holders of needed items, once per appointment, item and person. */
  remindItemHolders(): void {
    const now = Date.now();
    const beforeMs = calendarSettings.data.itemRemindHours * 3_600_000;
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
          data: {
            memberId: holder,
            recipients: [holder, ...this.people.guardiansOf([holder])],
            appointmentId: appointment.id,
            title: appointment.title,
            startsAt: appointment.startsAt,
            items,
          },
        });
      }
    }
    this.reminded.save();
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
    // server: Appointment.cabins — trimmed, trailing empty ones dropped, at most 4
    const cabins = (a.cabins ?? []).map((c) => (c ?? '').trim());
    while (cabins.length && !cabins[cabins.length - 1]) cabins.pop();
    if (cabins.some((c) => c.length > limits.cabinMaxLength)) fail(400, 'appointment.cabin-too-long');
    if (cabins.length > 4 || (cabins.length && !type.cabins)) fail(400, 'appointment.cabin-not-allowed');
    const start = Date.parse(a.startsAt);
    const end = Date.parse(a.endsAt);
    if (isNaN(start) || isNaN(end) || end <= start) fail(400, 'appointment.times-invalid');
    if (end - start > type.maxDays * DAY_MS) fail(400, 'appointment.too-long');
    return {
      ...a,
      title: a.title.trim(),
      description: a.description || null,
      location: a.location || null,
      locationId: a.locationId ?? null,
      cabins,
      audience: MockCalendar.normalised(a.teamId, a.audience),
    };
  }

  /** server: Appointment constructor — no team and no entries = everyone; a team takes no audience. */
  private static normalised(teamId: string | null, audience: Reach | undefined): Reach {
    if (!audience || !hasAudience(audience)) return teamId ? NO_AUDIENCE : EVERYONE;
    if (teamId) fail(400, 'appointment.audience-invalid');
    return audience;
  }

  /** Demo data relative to today: weekly trainings, a match, club-wide events, one cancellation. */
  private seedAppointments(): Appointment[] {
    const clock = this.people.clock;
    const today = clock.today();
    const weekStart = ZonedClock.addDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7));
    const at = (offsetDays: number, time: string) => clock.toInstant(`${ZonedClock.addDays(weekStart, offsetDays)}T${time}`);
    const items: Appointment[] = [];
    let n = 0;
    type Seed = Omit<Appointment, 'id' | 'cancelled' | 'locationId' | 'cabins' | 'rides' | 'audience' | 'createdBy'> & Partial<Appointment>;
    const add = (a: Seed) =>
      items.push({
        id: `a-${++n}`,
        cancelled: false,
        locationId: null,
        cabins: [],
        rides: typeOf(a.type).rides,
        audience: a.teamId ? NO_AUDIENCE : EVERYONE,
        createdBy: null,
        ...a,
        description: a.description ?? null,
        location: a.location ?? null,
      });

    for (let week = -1; week < 6; week++) {
      const base = week * 7;
      for (const [day, series] of [
        [1, 's-damen-di'],
        [3, 's-damen-do'],
      ] as const) {
        add({
          seriesId: series,
          teamId: 't-damen',
          type: 'TRAINING',
          title: 'Training Damen 1',
          description: null,
          location: 'Turnhalle Nord',
          locationId: 'l-nord',
          cabins: ['', 'Kabine 3'],
          startsAt: at(base + day, '19:00'),
          endsAt: at(base + day, '21:00'),
        });
      }
      add({
        seriesId: 's-u16-mo',
        teamId: 't-u16',
        type: 'TRAINING',
        title: 'Training U16',
        description: null,
        location: 'Turnhalle Süd',
        locationId: 'l-sued',
        startsAt: at(base, '17:30'),
        endsAt: at(base, '19:00'),
        cancelled: week === 1,
      });
    }
    add({
      seriesId: null,
      teamId: 't-damen',
      type: 'MATCH',
      title: 'Heimspiel gegen VC Musterstadt',
      description: 'Treffpunkt 60 Minuten vor Spielbeginn in der Halle.',
      location: 'Turnhalle Nord',
      locationId: 'l-nord',
      startsAt: at(12, '15:00'),
      endsAt: at(12, '17:30'),
    });
    add({
      seriesId: null,
      teamId: 't-u16',
      type: 'TOURNAMENT',
      title: 'U16 Landesturnier',
      description: null,
      location: 'Sportzentrum West',
      locationId: 'l-west',
      startsAt: at(19, '09:00'),
      endsAt: at(19, '18:00'),
    });
    add({
      seriesId: null,
      teamId: null,
      type: 'MEETING',
      title: 'Mitgliederversammlung',
      description: 'Tagesordnung:\n1. Bericht des Vorstands\n2. Kassenbericht\n3. Allfälliges',
      location: 'Vereinsheim',
      locationId: 'l-heim',
      startsAt: at(16, '19:30'),
      endsAt: at(16, '21:30'),
    });
    add({
      seriesId: null,
      teamId: null,
      type: 'EVENT',
      title: 'Saisonabschluss',
      description: null,
      location: 'Vereinsheim',
      locationId: 'l-heim',
      startsAt: at(26, '18:00'),
      endsAt: at(26, '23:00'),
    });
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

  /** server: AttendanceRepository.eraseMember and the iCal token (CalendarHandlers) */
  private onMemberErased(memberId: string): void {
    for (const answers of Object.values(this.responses.data)) delete answers[memberId];
    const absences = this.absences.data.filter((a) => a.memberId !== memberId);
    this.absences.data.splice(0, this.absences.data.length, ...absences);
    const rides = this.rides.data.filter((r) => r.driverId !== memberId);
    this.rides.data.splice(0, this.rides.data.length, ...rides);
    for (const ride of this.rides.data) ride.passengers = ride.passengers.filter((id) => id !== memberId);
    delete this.feeds.data[memberId];
    // server: CalendarRepository.forgetMember
    for (const a of this.appointments.data.filter((x) => x.audience.memberIds.includes(memberId))) {
      a.audience = { ...a.audience, memberIds: a.audience.memberIds.filter((id) => id !== memberId) };
      // An audience left empty would read as the whole club: it falls back to admin and board.
      if (!hasAudience(a.audience)) a.audience = { ...a.audience, roles: [...ADMIN_BOARD] };
    }
    for (const table of [this.responses, this.absences, this.rides, this.feeds, this.appointments]) table.save();
  }

  private seedRides(): StoredRide[] {
    const match = this.appointments.data.find((a) => a.type === 'MATCH' && Date.parse(a.startsAt) > Date.now() && !a.cancelled);
    return match
      ? [{ id: 'ride-1', appointmentId: match.id, driverId: 'trainer', seats: 3, note: 'Abfahrt 1 Stunde vorher bei der Halle', passengers: [] }]
      : [];
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
// server: AttendanceRepository / CalendarRepository.personalData
personalData.set('attendance', (memberId) => ({
  answers: Object.entries(calendar.responses.data)
    .filter(([, answers]) => memberId in answers)
    .map(([appointmentId, answers]) => ({ appointmentId, ...answers[memberId] })),
  absences: calendar.absences.data.filter((a) => a.memberId === memberId),
  ridesOffered: calendar.rides.data.filter((r) => r.driverId === memberId),
  seatsTaken: calendar.rides.data.filter((r) => r.passengers.includes(memberId)).map((r) => ({ rideId: r.id })),
}));
personalData.set('calendar', (memberId) => ({ icalFeed: memberId in calendar.feeds.data ? [{ active: true }] : [] }));

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
    const type: AppointmentTypeInfo = {
      key: key ?? generatedKey('TYPE'),
      label,
      hue: body.hue,
      rides: !!body.rides,
      cabins: !!body.cabins,
      sort: body.sort,
      archived: !!body.archived,
      inUse: false,
      remindHours: body.remindHours == null ? null : body.remindHours,
      hasResult: !!body.hasResult,
      planLabel: typeof body.planLabel === 'string' && body.planLabel.trim() ? body.planLabel.trim() : null,
      defaultStart: body.defaultStart,
      defaultMinutes: body.defaultMinutes,
      maxDays: body.maxDays,
      answerDeadlineHours: body.answerDeadlineHours,
      allowMaybe: !!body.allowMaybe,
      reasonOnNo: !!body.reasonOnNo,
      expectAnswers: body.expectAnswers,
      notifyChanges: !!body.notifyChanges,
      minShiftMinutes: body.minShiftMinutes,
      selfCheckIn: !!body.selfCheckIn,
      remindAgainHours: body.remindAgainHours == null ? null : body.remindAgainHours,
    };
    if (type.remindHours != null && (!Number.isInteger(type.remindHours) || type.remindHours < 1 || type.remindHours > 336)) {
      fail(400, 'appointment-type.remind-invalid');
    }
    const whole = (n: unknown, min: number, max: number) => Number.isInteger(n) && (n as number) >= min && (n as number) <= max;
    if (
      (type.planLabel?.length ?? 0) > 40 ||
      typeof type.defaultStart !== 'string' ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(type.defaultStart) ||
      !whole(type.maxDays, 1, 30) ||
      !whole(type.defaultMinutes, 5, type.maxDays * 24 * 60) ||
      !whole(type.answerDeadlineHours, 0, 336) ||
      !['TEAM', 'CLUB', 'NONE'].includes(type.expectAnswers) ||
      !whole(type.minShiftMinutes, 0, 1440) ||
      (type.remindAgainHours != null && (type.remindHours == null || !whole(type.remindAgainHours, 1, type.remindHours - 1)))
    ) {
      fail(400, 'appointment-type.rules-invalid');
    }
    const index = types.data.findIndex((t) => t.key === type.key);
    if (index >= 0) types.data[index] = type;
    else types.data.push(type);
    types.save();
    mockServer.events.publish({ type: 'calendar.appointment-types-changed', data: {}, audience: { everyone: true } });
    return { ...type, inUse: calendar.appointments.data.some((a) => a.type === type.key) };
  },

  delete(member: Member, key: string): void {
    directory.requirePrivileged(member, ['ADMIN', 'BOARD']);
    const index = types.data.findIndex((t) => t.key === key);
    if (index < 0) fail(404, 'appointment-type.not-found');
    if (calendar.appointments.data.some((a) => a.type === key)) fail(409, 'appointment-type.in-use');
    types.data.splice(index, 1);
    types.save();
    mockServer.events.publish({ type: 'calendar.appointment-types-changed', data: {}, audience: { everyone: true } });
  },
};

// server: CalendarModule.remindItemHolders runs every 15 minutes; the browser mock checks on start and then periodically.
if (typeof window !== 'undefined') {
  // server: AttendanceModule.remindOpenAnswers (hourly) runs alongside
  const remind = () => {
    calendar.remindItemHolders();
    calendar.remindDue();
  };
  setTimeout(remind, 0);
  setInterval(remind, settings.inventory.reminderCheckMs);
}

itemUseSources.push((member, itemId) => calendar.itemUses(member, itemId));

const actor = (req: MockRequest) => directory.actor(req);

mockServer
  .on('GET', '/api/v1/appointments/:id/activity', (req) => activity.list(actor(req), 'APPOINTMENT', calendar.visible(actor(req), req.params.id).id))
  .on('GET', '/api/v1/calendar/settings', (req) => (directory.actor(req), calendar.settings()))
  .on('PUT', '/api/v1/calendar/settings', (req) => {
    const result = calendar.saveSettings(directory.actor(req), req.body ?? {});
    mockServer.events.publish({ type: 'calendar.settings-changed', data: {}, audience: { everyone: true } });
    return result;
  })
  .on('GET', '/api/v1/calendar/types', (req) => (directory.actor(req), appointmentTypes.list()))
  .on('POST', '/api/v1/calendar/types', (req) => appointmentTypes.save(directory.actor(req), null, req.body ?? {}))
  .on('PUT', '/api/v1/calendar/types/:key', (req) => appointmentTypes.save(directory.actor(req), req.params.key, req.body ?? {}))
  .on('DELETE', '/api/v1/calendar/types/:key', (req) => appointmentTypes.delete(directory.actor(req), req.params.key))
  .on('GET', '/api/v1/appointments', (req) => ({
    items: calendar.list(actor(req), req.query.get('from'), req.query.get('to'), req.query.get('teamId')),
  }))
  .on('POST', '/api/v1/appointments', (req) => ({ items: calendar.create(actor(req), req.body ?? {}) }))
  .on('GET', '/api/v1/appointments/:id', (req) => calendar.visible(actor(req), req.params.id))
  .on('PATCH', '/api/v1/appointments/:id', (req) => calendar.update(actor(req), req.params.id, req.body ?? {}))
  .on('POST', '/api/v1/appointments/cancel-range', (req) => ({ items: calendar.cancelRange(actor(req), req.body ?? {}) }))
  .on('POST', '/api/v1/appointments/:id/cancel', (req) => ({
    items: calendar.cancel(actor(req), req.params.id, req.query.get('includeFollowing') === 'true', req.body?.reason ?? null),
  }))
  .on('POST', '/api/v1/appointments/:id/restore', (req) => ({ items: [calendar.restore(actor(req), req.params.id)] }))
  .on('DELETE', '/api/v1/appointments/:id', (req) => calendar.delete(actor(req), req.params.id))
  .on('POST', '/api/v1/appointments/:id/remind-open', (req) => ({ count: calendar.remindOpen(actor(req), req.params.id) }))
  .on('PUT', '/api/v1/appointments/:id/presence', (req) => calendar.setPresence(actor(req), req.params.id, req.body ?? {}))
  .on('GET', '/api/v1/me/open-answers', (req) => calendar.openAnswers(actor(req)))
  .on('GET', '/api/v1/me/answers', (req) => ({ items: calendar.myAnswers(actor(req), req.query.get('from'), req.query.get('to')) }))
  .on('GET', '/api/v1/calendar/holidays', (req) => (actor(req), { items: calendar.holidays.data }))
  .on('POST', '/api/v1/calendar/holidays', (req) => {
    const result = calendar.saveHoliday(actor(req), null, req.body ?? {});
    mockServer.events.publish({ type: 'calendar.settings-changed', data: {}, audience: { everyone: true } });
    return result;
  })
  .on('PUT', '/api/v1/calendar/holidays/:id', (req) => {
    const result = calendar.saveHoliday(actor(req), req.params.id, req.body ?? {});
    mockServer.events.publish({ type: 'calendar.settings-changed', data: {}, audience: { everyone: true } });
    return result;
  })
  .on('DELETE', '/api/v1/calendar/holidays/:id', (req) => {
    const result = calendar.deleteHoliday(actor(req), req.params.id);
    mockServer.events.publish({ type: 'calendar.settings-changed', data: {}, audience: { everyone: true } });
    return result;
  })
  .on('POST', '/api/v1/appointments/:id/extend', (req) => ({ items: calendar.extend(actor(req), req.params.id, req.body?.repeatUntil) }))
  .on('GET', '/api/v1/appointments/:id/extras', (req) => calendar.extras(actor(req), req.params.id))
  .on('PUT', '/api/v1/appointments/:id/extras', (req) => calendar.setExtras(actor(req), req.params.id, req.body ?? {}))
  .on('GET', '/api/v1/teams/:id/matches', (req) => calendar.teamMatches(actor(req), req.params.id, req.query.get('from'), req.query.get('to')))
  .on('GET', '/api/v1/teams/:id/attendance', (req) => calendar.teamStats(actor(req), req.params.id, req.query.get('from'), req.query.get('to')))
  .on('GET', '/api/v1/appointments/:id/links', (req) => calendar.getLinks(actor(req), req.params.id))
  .on('PUT', '/api/v1/appointments/:id/links', (req) => calendar.setLinks(actor(req), req.params.id, req.body ?? {}))
  .on('GET', '/api/v1/appointments/:id/attendance', (req) => calendar.overview(actor(req), req.params.id))
  .on('GET', '/api/v1/me/absences', (req) => ({ items: calendar.listAbsences(actor(req), req.query.get('memberId')) }))
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
