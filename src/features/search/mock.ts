// Mock of the club-server search (gateway SearchController): asks every mock module through its own
// endpoint, as the gateway asks every module over the bus, and filters by text.
import { settings } from '../../settings';
import { directory } from '../../lib/mock/core';
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

const hit = (kind: HitKind, id: string, title: string, detail: string | null = null, at: string | null = null, folderId: string | null = null): SearchHit =>
  ({ kind, id, title, detail, at, folderId });

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

  const [appointments, tasks, teams, items, folders, files] = await Promise.all([
    list(req, `/api/v1/appointments?from=${from}&to=${to}`),
    list(req, '/api/v1/tasks?includeDone=true'),
    list(req, `/api/v1/teams?mine=${!board}`),
    list(req, '/api/v1/inventory'),
    list(req, '/api/v1/folders'),
    list(req, `/api/v1/files?q=${encodeURIComponent(query)}&limit=${limit}`),
  ]);
  const past = (a: Record<string, any>) => Date.parse(a.endsAt) < now;
  // A weekly series only once, at its next date.
  const series = new Set<string>();
  return {
    hits: [
      ...appointments
        .filter((a) => contains(needle, a.title, a.location, a.description))
        .sort((a, b) => Number(past(a)) - Number(past(b)) || (past(a) ? b.startsAt.localeCompare(a.startsAt) : a.startsAt.localeCompare(b.startsAt)))
        .filter((a) => !a.seriesId || !series.has(a.seriesId) && !!series.add(a.seriesId))
        .slice(0, limit)
        .map((a) => hit('APPOINTMENT', a.id, a.title, a.cancelled ? 'Abgesagt' : a.location, a.startsAt)),
      ...tasks.filter((t) => contains(needle, t.title, t.description)).slice(0, limit).map((t) => hit('TASK', t.id, t.title, t.status, t.dueAt)),
      ...members(req, needle, limit),
      ...teams.filter((t) => contains(needle, t.name, t.season)).slice(0, limit).map((t) => hit('TEAM', t.id, t.name, t.season)),
      ...items.filter((i) => contains(needle, i.name, i.category, i.location, i.description)).slice(0, limit).map((i) => hit('ITEM', i.id, i.name, i.category)),
      ...folders.filter((f) => contains(needle, f.name)).slice(0, limit).map((f) => hit('FOLDER', f.id, f.name, null, null, f.parentId)),
      ...files.map((f) => hit('FILE', f.id, f.name, f.folderName, null, f.folderId)),
    ],
  };
});
