import type { Member } from '../types';
import { directory, type MockDirectory } from './core';
import { MockServer, mockServer } from './MockServer';
import { MockTable } from './MockTable';

export type ActivityKind = 'TASK' | 'APPOINTMENT' | 'FILE';

/** What a module tells about the changed record (server: ActivityApi.Recorded). */
export interface RecordInfo {
  title: string;
  /** Teams of the record; empty = club-wide or board only. */
  teamIds: readonly string[];
  /** Folder of a file. */
  parentId?: string | null;
  detail?: string | null;
}

interface Recorded extends RecordInfo {
  kind: ActivityKind;
  recordId: string;
  actorId: string;
  action: string;
}

interface StoredEntry extends Recorded {
  at: string;
}

/**
 * Mock of the server's activity module: modules publish `activity.recorded` on the mock event bus,
 * this module stores it; reading is for admin, board and coaches (coaches: their teams in the feed).
 */
export class MockActivity {
  static readonly LIMIT = 200;
  static readonly FEED_LIMIT = 100;
  readonly entries = new MockTable<StoredEntry[]>('activity', () => []);

  constructor(private readonly people: MockDirectory) {
    mockServer.events.subscribe((event) => {
      if (event.type === 'activity.purged') {
        // server: ActivityHandlers on PURGED (privacy erasure of a record)
        const { kind, recordId } = event.data as { kind: ActivityKind; recordId: string };
        const kept = this.entries.data.filter((e) => e.kind !== kind || e.recordId !== recordId);
        this.entries.data.splice(0, this.entries.data.length, ...kept);
        this.entries.save();
      }
      if (event.type !== 'activity.recorded') return;
      this.entries.data.push({ ...(event.data as Recorded), at: new Date().toISOString() });
      this.entries.save();
    });
  }

  /** server: TaskHandlers.record etc. */
  static record(kind: ActivityKind, recordId: string, actor: Member, action: string, info: RecordInfo): void {
    mockServer.events.publish({ type: 'activity.recorded', data: { ...info, kind, recordId, actorId: actor.id, action } satisfies Recorded });
  }

  /** server: ActivityHandlers.list; the caller has checked that the member sees the record. */
  list(member: Member, kind: ActivityKind, recordId: string) {
    this.requirePrivileged(member);
    return {
      items: this.newestFirst()
        .filter((e) => e.kind === kind && e.recordId === recordId)
        .slice(0, MockActivity.LIMIT)
        .map(({ actorId, action, detail, at }) => ({ actorId, actorName: this.people.name(actorId) ?? null, action, detail: detail ?? null, at })),
    };
  }

  /** server: ActivityHandlers.feed */
  feed(member: Member, kind: string | null, before: string | null, limit: number) {
    this.requirePrivileged(member);
    const roles = this.people.teamRoles(member.id);
    const coached = Object.keys(roles).filter((t) => roles[t] === 'COACH');
    const all = this.people.isManager(member);
    if (!all && !coached.length) return { items: [], next: null };
    const max = Math.min(Math.max(limit || 50, 1), MockActivity.FEED_LIMIT);
    const items = this.newestFirst()
      .filter((e) => (!kind || e.kind === kind) && (!before || e.at < before) && (all || e.teamIds.some((t) => coached.includes(t))))
      .slice(0, max)
      .map((e) => ({
        kind: e.kind,
        recordId: e.recordId,
        parentId: e.parentId ?? null,
        title: e.title,
        actorId: e.actorId,
        actorName: this.people.name(e.actorId) ?? null,
        action: e.action,
        detail: e.detail ?? null,
        at: e.at,
      }));
    return { items, next: items.length < max ? null : items.at(-1)!.at };
  }

  private newestFirst(): StoredEntry[] {
    return [...this.entries.data].reverse();
  }

  private requirePrivileged(member: Member): void {
    if (!this.people.isPrivileged(member)) MockServer.fail(403, 'access.denied');
  }
}

export const activity = new MockActivity(directory);

mockServer.on('GET', '/api/v1/activity', (req) =>
  activity.feed(directory.actor(req), req.query.get('kind'), req.query.get('before'), Number(req.query.get('limit') ?? 50)));
