import type { ApiClient } from '../http/ApiClient';
import type { AuditEntry } from '../types';

/** server: AuditLog.AuditKind - a look at member data, a change, a data export. */
export type AuditKind = 'READ' | 'WRITE' | 'EXPORT';

/** server: AuditLog.list - filters run on the server, so they reach the whole log, not only loaded pages. */
export interface AuditQuery {
  kind?: AuditKind | null;
  /** First path segment after /api/v1/, e.g. `members`. */
  area?: string | null;
  actorId?: string | null;
  /** Entry id: older entries only. */
  before?: number | null;
}

/** The Protokoll (admin only). */
export class AuditApi {
  static readonly PAGE = 100;

  constructor(private readonly api: ApiClient) {}

  list(query: AuditQuery): Promise<{ items: AuditEntry[] }> {
    return this.api.get('/api/v1/audit', {
      kind: query.kind ?? null,
      area: query.area ?? null,
      actorId: query.actorId ?? null,
      before: query.before ?? null,
    });
  }
}
