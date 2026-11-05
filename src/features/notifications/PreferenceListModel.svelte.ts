import { ListModel } from '../../lib/list/ListModel.svelte';
import { NOTIFICATION_KINDS, type NotificationKind } from './model';

export interface PreferenceRow {
  value: NotificationKind;
  label: string;
  hint: string;
}

/** The kinds of notifications in their fixed order, with push and e-mail columns (the switches are cells of the section). */
export class PreferenceListModel extends ListModel<PreferenceRow> {
  constructor(load: () => Promise<readonly NotificationKind[]>) {
    super({
      id: 'notification-preferences',
      load: async () => {
        const kinds = await load();
        return NOTIFICATION_KINDS.filter((k) => kinds.includes(k.value));
      },
      // No sort column: the rows keep the order of NOTIFICATION_KINDS.
      defaultSort: { key: '', dir: 'asc' },
      columns: [
        { key: 'label', label: 'Art', value: (row) => row.label, sortable: false },
        { key: 'push', label: 'Push (App)', value: () => null, sortable: false, width: '7rem' },
        { key: 'email', label: 'E-Mail', value: () => null, sortable: false, width: '7rem' },
      ],
    });
  }
}
