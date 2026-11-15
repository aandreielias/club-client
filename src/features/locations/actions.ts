import { inWindow, type RecordActionProvider } from '../../lib/actions/RecordActions';
import { bus, pendingDeletes, permissions } from '../../lib/container';
import type { Location } from './model';
import { locationsApi } from './services';

/** What can be done with a place: context menus, its window and the command palette. */
export const locationActions: RecordActionProvider<Location> = {
  load: (id) => locationsApi.get(id),
  actions: (l) =>
    permissions.isPrivileged
      ? [
          inWindow(bus, 'location', l.id, 'record.edit', { icon: 'edit', group: 'edit' }),
          {
            command: 'record.delete',
            icon: 'delete',
            danger: true,
            group: 'edit',
            leaves: true,
            run: () =>
              pendingDeletes.schedule({
                ids: [l.id],
                text: `„${l.name}“ gelöscht. Termine behalten den Namen.`,
                commit: () => locationsApi.delete(l.id),
              }),
          },
        ]
      : [],
};
