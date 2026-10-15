import type { Formatter } from '../../lib/time/Formatter';
import { ListModel } from '../../lib/list/ListModel.svelte';
import type { LocalStore } from '../../lib/storage/LocalStore';
import { NOTIFICATION_KINDS, type Notification } from './model';
import type { NotificationCenter } from './NotificationCenter.svelte';

export const kindLabel = (kind: Notification['kind']): string => NOTIFICATION_KINDS.find((k) => k.value === kind)?.label ?? kind;

/** The inbox as a list; its data mirrors the NotificationCenter (shared with the sidebar badge). */
export class NotificationListModel extends ListModel<Notification> {
  constructor(center: NotificationCenter, format: () => Formatter, store: LocalStore) {
    super(
      {
        id: 'notifications',
        load: async () => {
          await center.inbox.load();
          return center.inbox.value?.items ?? [];
        },
        defaultSort: { key: 'createdAt', dir: 'desc' },
        searchText: (n) => `${n.title} ${n.body}`,
        columns: [
          { key: 'title', label: 'Nachricht', value: (n) => n.title },
          { key: 'kind', label: 'Art', value: (n) => kindLabel(n.kind), width: '10rem', hideOnCompact: true },
          { key: 'body', label: 'Details', value: (n) => n.body, sortable: false, hideOnCompact: true },
          { key: 'createdAt', label: 'Erhalten', value: (n) => n.createdAt, format: (n) => format().dateTime(n.createdAt), width: '11rem' },
        ],
        filters: [
          { key: 'unread', label: 'Nur ungelesene', kind: 'toggle', test: (n, on) => !on || !n.readAt },
          {
            key: 'kind',
            label: 'Art',
            kind: 'select',
            allLabel: 'Jede Art',
            options: () => NOTIFICATION_KINDS.map((k) => ({ value: k.value, label: k.label })),
            test: (n, value) => n.kind === value,
          },
        ],
      },
      store,
    );
  }
}
