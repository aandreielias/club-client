// Mock of the server's calendar collection (gateway CalendarItemsController + every module's calendar-items / calendar-move).
import { calendar } from '../../features/calendar/mock';
import { meetings } from '../../features/meetings/mock';
import { tasks } from '../../features/tasks/mock';
import { tournaments } from '../../features/tournaments/mock';
import type { CalendarItem } from '../calendar/CalendarSources';
import { ZonedClock } from '../time/ZonedClock';
import { PRIVILEGED, type Member } from '../types';
import { directory } from './core';
import { MockServer, mockServer } from './MockServer';

const fail = MockServer.fail;
const DAY = 86_400_000;
const OFFICES: Readonly<Record<string, string>> = { CHAIR: 'Vorsitz', VICE_CHAIR: 'Stellvertretung', TREASURER: 'Kassier:in',
  SECRETARY: 'Schriftführung', BOARD_MEMBER: 'Vorstandsmitglied', AUDITOR: 'Rechnungsprüfung' };

const base = { teamId: null, inactive: false, detail: null, movable: false, resizable: false };
const allDay = (clock: ZonedClock, first: string, last: string) =>
  ({ start: clock.startOfDay(first), end: clock.startOfDay(ZonedClock.addDays(last, 1)), allDay: true });
const name = (id: string) => {
  const m = directory.members.data.find((x) => x.id === id);
  return m ? `${m.firstName} ${m.lastName}` : 'Mitglied';
};
/** `fn` throws for what the viewer may not see (like the server's 404). */
const tryOr = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

/** server: each module's CalendarQuery handler, with its visibility rules. */
export function items(viewer: Member, from: string, to: string): CalendarItem[] {
  const clock = directory.clock;
  const fromDay = clock.localDate(from);
  const toDay = clock.localDate(new Date(Date.parse(to) - 1));
  const board = directory.isManager(viewer);
  const coached = Object.entries(directory.teamRoles(viewer.id)).filter(([, r]) => r === 'COACH').map(([t]) => t);
  const out: CalendarItem[] = [];

  for (const a of calendar.list(viewer, from, to, null)) {
    const editable = !a.cancelled && (board || (!!a.teamId && coached.includes(a.teamId)));
    out.push({ ...base, kind: 'appointment', id: a.id, title: a.title, start: a.startsAt, end: a.endsAt, allDay: false, category: 'APPOINTMENT',
      teamId: a.teamId, inactive: a.cancelled, detail: a.type, movable: editable, resizable: editable });
  }

  // Absences: own and minors', a coach's team members', everyone's for admin and board.
  const own = new Set([viewer.id, ...directory.wardsOf(viewer.id)]);
  const seen = new Set([...own, ...coached.flatMap((t) => directory.teamMembers(t))]);
  for (const a of calendar.absences.data.filter((x) => (board || seen.has(x.memberId)) && x.to >= fromDay && x.from <= toDay)) {
    const mine = own.has(a.memberId);
    out.push({ ...base, kind: 'absence', id: a.id, title: `Abwesend: ${name(a.memberId)}`, ...allDay(clock, a.from, a.to), category: 'ABSENCE',
      detail: board || viewer.roles.includes('COACH') || mine ? a.reason : null, movable: mine, resizable: mine });
  }

  for (const t of tasks.list(viewer, false, null, true, from, to)) {
    if (!t.dueAt) continue;
    const manages = !t.teamId ? board : coached.includes(t.teamId) || board;
    const followUp = Object.entries(tasks.sources.data).some(([id, s]) => id === t.id && s.kind === 'MEETING_FOLLOW_UP');
    out.push({ ...base, kind: 'task', id: t.id, title: t.title, start: t.dueAt, end: null, allDay: true, category: followUp ? 'FOLLOW_UP' : 'TASK',
      teamId: t.teamId, inactive: t.status === 'DONE', detail: t.status, movable: manages && t.status !== 'DONE' });
  }

  const runsTournaments = directory.hasRole(viewer, PRIVILEGED);
  for (const t of tournaments.list(viewer).items.filter((x) => x.startsOn <= toDay && x.endsOn >= fromDay)) {
    out.push({ ...base, kind: 'tournament', id: t.id, title: t.name, ...allDay(clock, t.startsOn, t.endsOn), category: 'TOURNAMENT',
      inactive: t.status === 'DONE', detail: t.status, movable: runsTournaments, resizable: runsTournaments });
  }

  // Meetings; for admin and board also invitation deadlines and open circular votes.
  const until = board ? new Date(Date.parse(to) + 15 * DAY).toISOString() : to;
  for (const m of meetings.list(viewer, new Date(Date.parse(from) - DAY).toISOString(), until).items) {
    const full = tryOr(() => meetings.get(viewer, m.id), null);
    if (m.startsAt < to && m.endsAt > from) {
      const editable = m.status === 'DRAFT' && !!full?.canManage;
      out.push({ ...base, kind: 'meeting', id: m.id, title: m.title, start: m.startsAt, end: m.endsAt, allDay: false, category: 'MEETING',
        inactive: m.status === 'CLOSED', detail: m.kind, movable: editable, resizable: editable });
    }
    if (board && m.status === 'DRAFT' && full && full.latestInvite >= from && full.latestInvite < to) {
      out.push({ ...base, kind: 'meeting', id: m.id, title: `Einladen: ${m.title}`, start: full.latestInvite, end: null, allDay: true, category: 'DEADLINE', detail: 'INVITE' });
    }
  }
  if (board) {
    for (const r of meetings.listResolutions(viewer, null).items.filter((x) => x.status === 'OPEN' && x.openedAt! < to && x.deadline! > from)) {
      out.push({ ...base, kind: 'resolution', id: r.id, title: `Umlaufbeschluss: ${r.title}`, start: r.openedAt!, end: r.deadline, allDay: false,
        category: 'DEADLINE', detail: 'CIRCULAR', resizable: r.canManage });
    }
  }

  // Birthdays of those whose birth date the viewer sees: self, minors, coached team members, everyone for admin and board.
  for (const m of directory.members.data.filter((x) => x.active && x.birthDate && !x.roles.includes('GUEST') && (board || seen.has(x.id)))) {
    for (let year = Number(fromDay.slice(0, 4)); year <= Number(toDay.slice(0, 4)); year++) {
      const day = `${year}${m.birthDate!.slice(4)}`;
      if (day >= fromDay && day <= toDay) {
        out.push({ ...base, kind: 'member', id: m.id, title: `Geburtstag: ${m.firstName} ${m.lastName}`, ...allDay(clock, day, day), category: 'BIRTHDAY',
          detail: String(year - Number(m.birthDate!.slice(0, 4))) });
      }
    }
  }

  for (const o of directory.board().offices.filter((x) => x.termEndsOn >= fromDay && x.termEndsOn <= toDay)) {
    out.push({ ...base, kind: 'office', id: o.id, title: `Funktionsperiode endet: ${OFFICES[o.office]} – ${o.name}`, start: clock.startOfDay(o.termEndsOn),
      end: null, allDay: true, category: 'OFFICE', detail: o.office });
  }
  return out.sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
}

/** server: the modules' CalendarMove handlers. */
export function move(viewer: Member, kind: string, id: string, start: string, end: string | null): void {
  const clock = directory.clock;
  const lastDay = () => clock.localDate(new Date(Date.parse(end ?? start) - (end ? 1 : 0)));
  switch (kind) {
    case 'appointment':
      calendar.update(viewer, id, { startsAt: start, endsAt: end ?? start });
      return;
    case 'task':
      tasks.update(viewer, id, { dueAt: start });
      return;
    case 'tournament':
      tournaments.update(viewer, id, { startsOn: clock.localDate(start), endsOn: lastDay() });
      return;
    case 'meeting':
      meetings.update(viewer, id, { startsAt: start, endsAt: end ?? start });
      return;
    case 'resolution':
      meetings.extendDeadline(viewer, id, start, end);
      return;
    case 'absence':
      calendar.moveAbsence(viewer, id, clock.localDate(start), lastDay());
      return;
    default:
      fail(404, 'calendar.not-movable');
  }
}

mockServer
  .on('GET', '/api/v1/calendar/items', (req) => {
    const from = req.query.get('from') ?? '';
    const to = req.query.get('to') ?? '';
    if (!from || !to || to <= from || Date.parse(to) - Date.parse(from) > 366 * DAY) fail(400, 'calendar.range-invalid');
    return { items: items(directory.actor(req), from, to) };
  })
  .on('PUT', '/api/v1/calendar/items/:kind/:id', (req) => {
    const { start, end } = req.body ?? {};
    if (typeof start !== 'string' || (end != null && end <= start)) fail(400, 'calendar.range-invalid');
    move(directory.actor(req), req.params.kind, req.params.id, start, end ?? null);
    return null;
  });
