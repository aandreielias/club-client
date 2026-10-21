import { ACTIVITY_ACTIONS, type ActivityApi, type ActivityKind, type FeedEntry } from '../../lib/activity/ActivityApi';
import { ListModel } from '../../lib/list/ListModel.svelte';
import { Action } from '../../lib/state/Action.svelte';
import type { LocalStore } from '../../lib/storage/LocalStore';
import type { Formatter } from '../../lib/time/Formatter';
import { statusLabel, type TaskStatus } from '../tasks/model';

const KIND_LABELS: Readonly<Record<ActivityKind, string>> = { TASK: 'Aufgabe', APPOINTMENT: 'Termin', FILE: 'Datei' };

/** German text of one change, e.g. "Status: Erledigt". */
function changeText(e: FeedEntry): string {
  if (e.action === 'STATUS' && e.detail) return `Status: ${statusLabel(e.detail as TaskStatus)}`;
  if (e.kind === 'FILE' && e.action === 'UPDATED') return 'umbenannt oder verschoben';
  return ACTIVITY_ACTIONS[e.action] ?? e.action;
}

/** The "Logs" list: newest changes first, filtered by kind on the server, older pages on demand. */
export class ActivityFeedModel extends ListModel<FeedEntry> {
  readonly more = new Action();
  #next: string | null = $state(null);
  /** Bumped by every first-page load: a "more" answer that arrives after it belongs to the old list. */
  #page = 0;
  #kind: ActivityKind | null = null;

  constructor(
    private readonly api: ActivityApi,
    format: () => Formatter,
    store: LocalStore | null,
    private readonly pageSize: number,
  ) {
    super(
      {
        id: 'activity',
        load: async (server) => {
          this.#kind = (server.kind || null) as ActivityKind | null;
          this.#page++;
          const page = await api.feed(this.#kind, null, pageSize);
          this.#next = page.next;
          return page.items;
        },
        defaultSort: { key: 'at', dir: 'desc' },
        searchText: (e) => `${e.title ?? ''} ${e.actorName ?? ''} ${changeText(e)}`,
        columns: [
          { key: 'at', label: 'Wann', value: (e) => e.at, format: (e) => format().dateTime(e.at), width: '10rem' },
          { key: 'actor', label: 'Wer', value: (e) => e.actorName ?? 'Gelöschtes Mitglied', width: '12rem' },
          { key: 'kind', label: 'Bereich', value: (e) => KIND_LABELS[e.kind], width: '7rem', hideOnCompact: true },
          { key: 'title', label: 'Was', value: (e) => e.title },
          { key: 'change', label: 'Änderung', value: (e) => changeText(e), width: '12rem' },
        ],
        filters: [
          {
            key: 'kind',
            label: 'Bereich',
            kind: 'select',
            allLabel: 'Alle Bereiche',
            options: () => Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label })),
          },
        ],
      },
      store,
    );
  }

  get hasMore(): boolean {
    return this.#next !== null;
  }

  /** Appends the next older page. */
  loadMore(): Promise<boolean> {
    return this.more.run(async () => {
      if (!this.#next) return;
      const started = this.#page;
      const page = await this.api.feed(this.#kind, this.#next, this.pageSize);
      if (started !== this.#page) return;
      this.#next = page.next;
      this.set([...(this.data.value ?? []), ...page.items]);
    });
  }
}
