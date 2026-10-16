import type { ApiClient } from '../http/ApiClient';

/** Records with an activity log (server: ActivityApi.Kind). */
export type ActivityKind = 'TASK' | 'APPOINTMENT' | 'FILE';

/** One change (server: ActivityApi.EntryDto); actorName null when the member was deleted. */
export interface ActivityEntry {
  actorId: string | null;
  actorName: string | null;
  action: string;
  detail: string | null;
  at: string;
}

/** One change of the feed (server: ActivityApi.FeedEntry); `parentId` is the folder of a file. */
export interface FeedEntry extends ActivityEntry {
  kind: ActivityKind;
  recordId: string;
  parentId: string | null;
  title: string | null;
}

export interface ActivityFeed {
  items: FeedEntry[];
  /** Pass as `before` for older entries; null at the end. */
  next: string | null;
}

/** Who changed a record when; admin, board and coaches only. */
export class ActivityApi {
  static readonly PATHS: Record<ActivityKind, string> = { TASK: '/api/v1/tasks', APPOINTMENT: '/api/v1/appointments', FILE: '/api/v1/files' };

  constructor(private readonly api: ApiClient) {}

  /** The "Logs" page: changes across records, newest first; `before` pages back (`next` of the previous page). */
  feed(kind: ActivityKind | null, before: string | null, limit: number): Promise<ActivityFeed> {
    return this.api.get<ActivityFeed>('/api/v1/activity', { kind, before, limit });
  }

  async list(kind: ActivityKind, id: string): Promise<ActivityEntry[]> {
    return (await this.api.get<{ items: ActivityEntry[] }>(`${ActivityApi.PATHS[kind]}/${encodeURIComponent(id)}/activity`)).items;
  }
}

/** German text of an action; `detail` (a status or a name) is described by the caller where needed. */
export const ACTIVITY_ACTIONS: Readonly<Record<string, string>> = {
  CREATED: 'angelegt',
  UPDATED: 'geändert',
  STATUS: 'Status geändert',
  COMMENTED: 'kommentiert',
  DELETED: 'gelöscht',
  CANCELLED: 'abgesagt',
  UPLOADED: 'hochgeladen',
  TAGGED: 'Personen markiert',
};
