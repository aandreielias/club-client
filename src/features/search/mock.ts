// Mock of the club-server search (gateway SearchController + each module's search handler): asks every mock module
// through its own endpoint and filters by text, with the rules of the module's search.
import { settings } from '../../settings';
import { directory } from '../../lib/mock/core';
import { mail } from '../mail/mock';
import { MockServer, mockServer, type MockRequest } from '../../lib/mock/MockServer';
import type { HitKind, SearchHit } from './model';

const DAY = 86_400_000;

interface Listed {
  items?: Record<string, any>[];
  files?: Record<string, any>[];
}

async function list(req: MockRequest, path: string): Promise<Record<string, any>[]> {
  const answer = (await mockServer.handle('GET', path, null, req.email)) as Listed;
  return answer.items ?? answer.files ?? [];
}

const contains = (needle: string, ...texts: (string | null | undefined)[]) => texts.some((t) => t?.toLocaleLowerCase().includes(needle));

const hit = (
  kind: HitKind,
  id: string,
  title: string,
  detail: string | null = null,
  at: string | null = null,
  folderId: string | null = null,
  windowId: string | null = null,
): SearchHit => ({ kind, id, title, detail, at, folderId, windowId });

/** server: MemberHandlers.search; non-board members find profiles they may open. */
function members(req: MockRequest, needle: string, limit: number): SearchHit[] {
  const viewer = directory.actor(req);
  const board = directory.isManager(viewer);
  const wards = directory.wardsOf(viewer.id);
  return directory.members.data
    .filter((m) => m.active && (board || m.id === viewer.id || wards.includes(m.id) || directory.isCoachOf(viewer.id, m.id)))
    .filter((m) => `${m.firstName} ${m.lastName}`.toLocaleLowerCase().includes(needle))
    .sort((a, b) => a.lastName.localeCompare(b.lastName, 'de') || a.firstName.localeCompare(b.firstName, 'de'))
    .slice(0, limit)
    .map((m) => hit('MEMBER', m.id, `${m.firstName} ${m.lastName}`));
}

mockServer.on('GET', '/api/v1/search', async (req) => {
  const query = (req.query.get('q') ?? '').trim();
  if (query.length < settings.search.minQueryLength || query.length > settings.search.maxQueryLength) MockServer.fail(400, 'search.query-invalid');
  const limit = Math.min(Math.max(Number(req.query.get('limit') ?? 8), 1), 25);
  const needle = query.toLocaleLowerCase();
  const now = Date.now();
  const from = new Date(now - 120 * DAY).toISOString();
  const to = new Date(now + 240 * DAY).toISOString();
  const board = directory.isManager(directory.actor(req));

  const [appointments, tasks, teams, items, places, cups, meetings, resolutions, folders, files, mails] = await Promise.all([
    list(req, `/api/v1/appointments?from=${from}&to=${to}`),
    list(req, '/api/v1/tasks?includeDone=true'),
    list(req, `/api/v1/teams?mine=${!board}`),
    // server: InventoryHandlers.search - item hits only for admin, board and coaches.
    directory.isPrivileged(directory.actor(req)) ? list(req, '/api/v1/inventory') : Promise.resolve([]),
    list(req, '/api/v1/locations'),
    list(req, '/api/v1/tournaments'),
    list(req, '/api/v1/meetings'),
    list(req, '/api/v1/resolutions/all'),
    list(req, '/api/v1/folders'),
    list(req, `/api/v1/files?q=${encodeURIComponent(query)}&limit=${limit}`),
    Promise.resolve(mail.search(directory.actor(req), query, limit)), // server: MailApi.SEARCH, no endpoint of its own
  ]);
  const past = (a: Record<string, any>) => Date.parse(a.endsAt) < now;
  const placeHits = places.filter((l) => contains(needle, l.name, l.address)).slice(0, limit);
  const memberHits = members(req, needle, limit);
  // server: InventoryHandlers.search - also items stocked at a place or held by a member the search finds
  const stockIds = new Set([...placeHits, ...memberHits].map((h) => h.id));
  // A weekly series only once, at its next date.
  const series = new Set<string>();
  return {
    hits: [
      ...appointments
        .filter((a) => contains(needle, a.title, a.location, a.description))
        .sort((a, b) => Number(past(a)) - Number(past(b)) || (past(a) ? b.startsAt.localeCompare(a.startsAt) : a.startsAt.localeCompare(b.startsAt)))
        .filter((a) => !a.seriesId || (!series.has(a.seriesId) && !!series.add(a.seriesId)))
        .slice(0, limit)
        .map((a) => hit('APPOINTMENT', a.id, a.title, a.cancelled ? 'Abgesagt' : a.location, a.startsAt)),
      ...tasks
        .filter((t) => contains(needle, t.title, t.description))
        .slice(0, limit)
        .map((t) => hit('TASK', t.id, t.title, t.status, t.dueAt)),
      ...memberHits,
      ...teams
        .filter((t) => contains(needle, t.name, t.season))
        .slice(0, limit)
        .map((t) => hit('TEAM', t.id, t.name, t.season)),
      ...items
        .filter(
          (i) => contains(needle, i.name, i.category, i.description) || i.stock.some((s: Record<string, any>) => s.id !== null && stockIds.has(s.id)),
        )
        .slice(0, limit)
        .map((i) => hit('ITEM', i.id, i.name, i.category)),
      ...placeHits.map((l) => hit('LOCATION', l.id, l.name, l.address)),
      ...cups
        .filter((t) => contains(needle, t.name))
        .slice(0, limit)
        .map((t) => hit('TOURNAMENT', t.id, t.name)),
      ...meetings
        .filter((m) => contains(needle, m.title, m.location))
        .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
        .slice(0, limit)
        .map((m) => hit('MEETING', m.id, m.title, m.location, m.startsAt)),
      ...resolutions
        .filter((r) => contains(needle, r.title, r.meetingTitle))
        .slice(0, limit)
        .map((r) => hit('RESOLUTION', r.id, r.title, r.meetingTitle ?? 'Umlaufbeschluss', r.closedAt ?? r.openedAt)),
      ...folders
        .filter((f) => contains(needle, f.name))
        .slice(0, limit)
        .map((f) => hit('FOLDER', f.id, f.name, null, null, f.parentId)),
      ...files.map((f) => hit('FILE', f.id, f.name, f.folderName, null, f.folderId)),
      ...mails.map((m) => hit('MAIL', m.mailboxId, m.subject, m.fromName, m.sentAt, null, `${m.mailboxId}:${m.mailId}`)),
    ],
  };
});
