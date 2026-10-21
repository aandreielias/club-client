import type { LocalStore } from '../storage/LocalStore';

export interface RecentRecord {
  kind: string;
  id: string;
  title: string;
}

/** Records opened in the window, newest first (per browser); the command palette offers them. */
export class RecentRecords {
  static readonly KEY = 'recent-records';

  items = $state<RecentRecord[]>([]);

  constructor(
    private readonly store: LocalStore | null,
    private readonly max: number,
  ) {
    const stored = store?.get<RecentRecord[]>(RecentRecords.KEY);
    this.items = Array.isArray(stored) ? stored.filter((r) => r && typeof r.kind === 'string' && typeof r.id === 'string').slice(0, max) : [];
  }

  remember(record: RecentRecord): void {
    const rest = this.items.filter((r) => r.kind !== record.kind || r.id !== record.id);
    this.items = [record, ...rest].slice(0, this.max);
    this.store?.set(RecentRecords.KEY, this.items);
  }

  /** After logout: the next member must not see the previous one's records. */
  clear(): void {
    this.items = [];
    this.store?.remove(RecentRecords.KEY);
  }

  forget(kind: string, id: string): void {
    this.items = this.items.filter((r) => r.kind !== kind || r.id !== id);
    this.store?.set(RecentRecords.KEY, this.items);
  }
}
