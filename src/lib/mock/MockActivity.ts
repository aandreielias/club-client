import type { Member } from '../types';
import { directory, type MockDirectory } from './core';
import { MockServer, mockServer } from './MockServer';
import { MockTable } from './MockTable';

export type ActivityKind = 'TASK' | 'APPOINTMENT' | 'FILE';

interface StoredEntry {
  kind: ActivityKind;
  recordId: string;
  actorId: string;
  action: string;
  detail: string | null;
  at: string;
}

/** Internal event of the mock modules (server: ActivityApi.Recorded on club/activity/evt/recorded). */
interface Recorded {
  kind: ActivityKind;
  recordId: string;
  actorId: string;
  action: string;
  detail: string | null;
}

/**
 * Mock of the server's activity module: modules publish `activity.recorded` on the mock event bus,
 * this module stores it; reading is for admin, board and coaches.
 */
export class MockActivity {
  static readonly LIMIT = 200;
  readonly entries = new MockTable<StoredEntry[]>('activity', () => []);

  constructor(private readonly people: MockDirectory) {
    mockServer.events.subscribe((event) => {
      if (event.type !== 'activity.recorded') return;
      this.entries.data.push({ ...(event.data as Recorded), at: new Date().toISOString() });
      this.entries.save();
    });
  }

  /** server: TaskHandlers.record etc. */
  static record(kind: ActivityKind, recordId: string, actor: Member, action: string, detail: string | null = null): void {
    mockServer.events.publish({ type: 'activity.recorded', data: { kind, recordId, actorId: actor.id, action, detail } satisfies Recorded });
  }

  /** server: ActivityHandlers.list; the caller has checked that the member sees the record. */
  list(member: Member, kind: ActivityKind, recordId: string) {
    if (!this.people.isPrivileged(member)) MockServer.fail(403, 'access.denied');
    return {
      items: this.entries.data
        .filter((e) => e.kind === kind && e.recordId === recordId)
        .reverse()
        .slice(0, MockActivity.LIMIT)
        .map(({ actorId, action, detail, at }) => ({ actorId, actorName: this.people.name(actorId) ?? null, action, detail, at })),
    };
  }
}

export const activity = new MockActivity(directory);
