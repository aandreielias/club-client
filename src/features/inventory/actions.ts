import { inWindow, type RecordActionProvider } from '../../lib/actions/RecordActions';
import { bus, pendingDeletes, permissions } from '../../lib/container';
import type { Item } from './model';
import { inventoryApi } from './services';

/** What can be done with an item: context menus, its window and the command palette. */
export const itemActions: RecordActionProvider<Item> = {
  load: (id) => inventoryApi.get(id),
  actions: (i) =>
    permissions.isPrivileged
      ? [
          inWindow(bus, 'item', i.id, 'record.edit', { icon: 'edit', group: 'edit' }),
          inWindow(bus, 'item', i.id, 'item.stock', { group: 'edit' }),
          {
            command: 'record.delete',
            icon: 'delete',
            danger: true,
            group: 'remove',
            leaves: true,
            // Appointments and tasks that need it show it as deleted afterwards.
            run: () => pendingDeletes.schedule({ ids: [i.id], text: `„${i.name}“ gelöscht.`, commit: () => inventoryApi.delete(i.id) }),
          },
        ]
      : [],
};
