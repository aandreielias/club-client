// Linked records of messages and meetings (server: platform.RecordRefs).

/** Records that can be linked. */
export type RefKind = 'TASK' | 'APPOINTMENT' | 'ITEM' | 'FILE' | 'MEMBER' | 'TEAM' | 'LOCATION' | 'TOURNAMENT' | 'MEETING';

/** A linked record with its title when it was linked; parentId: a file's folder. */
export interface LinkedRef {
  kind: RefKind;
  id: string;
  title: string;
  parentId: string | null;
}

export const REF_ICONS = {
  TASK: 'tasks',
  APPOINTMENT: 'calendar',
  ITEM: 'inventory',
  FILE: 'document',
  MEMBER: 'account',
  TEAM: 'teams',
  LOCATION: 'location',
  TOURNAMENT: 'trophy',
  MEETING: 'meetings',
} as const;

/** Window that opens a linked record. */
export function refWindow(ref: Pick<LinkedRef, 'kind' | 'id' | 'parentId'>): { kind: string; id: string } {
  return ref.kind === 'FILE' ? { kind: 'file', id: `${ref.parentId}:${ref.id}` } : { kind: ref.kind.toLowerCase(), id: ref.id };
}

/** Window kinds of records that can be dragged onto a link list (RecordDrag) and their ref kind. */
export const DROPPABLE: Readonly<Record<string, RefKind>> = {
  appointment: 'APPOINTMENT',
  task: 'TASK',
  item: 'ITEM',
  file: 'FILE',
  member: 'MEMBER',
  team: 'TEAM',
  location: 'LOCATION',
  tournament: 'TOURNAMENT',
  meeting: 'MEETING',
};
