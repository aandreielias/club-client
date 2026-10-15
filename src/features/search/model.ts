// Mirror of the club-server search DTOs (gateway SearchController).

export type HitKind = 'APPOINTMENT' | 'TASK' | 'MEMBER' | 'TEAM' | 'ITEM' | 'FOLDER' | 'FILE';

export interface SearchHit {
  kind: HitKind;
  id: string;
  title: string;
  /** Location, team season, item category, folder name; a task's status code. */
  detail: string | null;
  /** Start of an appointment or due date of a task. */
  at: string | null;
  /** Folder of a file; parent of a folder. */
  folderId: string | null;
}

export interface SearchResult {
  hits: SearchHit[];
}

/** In the order results are grouped. */
export const HIT_KINDS: readonly { value: HitKind; label: string }[] = [
  { value: 'APPOINTMENT', label: 'Termin' },
  { value: 'TASK', label: 'Aufgabe' },
  { value: 'MEMBER', label: 'Mitglied' },
  { value: 'TEAM', label: 'Team' },
  { value: 'ITEM', label: 'Inventar' },
  { value: 'FOLDER', label: 'Ordner' },
  { value: 'FILE', label: 'Datei' },
];

export const kindLabel = (kind: HitKind): string => HIT_KINDS.find((k) => k.value === kind)?.label ?? kind;
export const kindRank = (kind: HitKind): number => HIT_KINDS.findIndex((k) => k.value === kind);

/** Task status codes as the tasks feature names them (features may not import each other). */
const TASK_STATUS: Readonly<Record<string, string>> = { OPEN: 'Offen', IN_PROGRESS: 'In Arbeit', DONE: 'Erledigt' };

export function hitDetail(hit: SearchHit): string {
  if (hit.kind === 'TASK') return hit.detail ? (TASK_STATUS[hit.detail] ?? hit.detail) : '';
  return hit.detail ?? '';
}

/** Where a hit opens: a window for records, the files page for folders. */
export function hitTarget(hit: SearchHit): { window: { kind: string; id: string } } | { path: string } {
  switch (hit.kind) {
    case 'APPOINTMENT':
      return { window: { kind: 'appointment', id: hit.id } };
    case 'TASK':
      return { window: { kind: 'task', id: hit.id } };
    case 'MEMBER':
      return { window: { kind: 'member', id: hit.id } };
    case 'TEAM':
      return { window: { kind: 'team', id: hit.id } };
    case 'ITEM':
      return { window: { kind: 'item', id: hit.id } };
    case 'FILE':
      return { window: { kind: 'file', id: `${hit.folderId}:${hit.id}` } };
    case 'FOLDER':
      return { path: `/files/${encodeURIComponent(hit.id)}` };
  }
}
