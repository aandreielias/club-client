import { TASK_STATUS_LABELS } from '../../lib/types';
// Mirror of the club-server search DTOs (gateway SearchController).

export type HitKind = 'APPOINTMENT' | 'TASK' | 'MEMBER' | 'TEAM' | 'ITEM' | 'LOCATION' | 'TOURNAMENT' | 'FOLDER' | 'FILE';

export interface SearchHit {
  kind: HitKind;
  id: string;
  title: string;
  /** Location, team season, item category, a place's address, folder name; a task's status code. */
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
  { value: 'LOCATION', label: 'Ort' },
  { value: 'TOURNAMENT', label: 'Turnier' },
  { value: 'FOLDER', label: 'Ordner' },
  { value: 'FILE', label: 'Datei' },
];

export const kindLabel = (kind: HitKind): string => HIT_KINDS.find((k) => k.value === kind)?.label ?? kind;
export const kindRank = (kind: HitKind): number => HIT_KINDS.findIndex((k) => k.value === kind);


export function hitDetail(hit: SearchHit): string {
  if (hit.kind === 'TASK') return hit.detail ? (TASK_STATUS_LABELS[hit.detail as keyof typeof TASK_STATUS_LABELS] ?? hit.detail) : '';
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
    case 'LOCATION':
      return { window: { kind: 'location', id: hit.id } };
    case 'TOURNAMENT':
      return { window: { kind: 'tournament', id: hit.id } };
    case 'FILE':
      return { window: { kind: 'file', id: `${hit.folderId}:${hit.id}` } };
    case 'FOLDER':
      return { path: `/files/${encodeURIComponent(hit.id)}` };
  }
}
