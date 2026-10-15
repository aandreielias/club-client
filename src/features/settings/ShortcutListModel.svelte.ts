import { SHORTCUTS, type CommandId } from '../../shortcuts';
import type { Keymap } from '../../lib/keyboard/Keymap.svelte';
import { KeySpec } from '../../lib/keyboard/KeySpec';
import { ListModel } from '../../lib/list/ListModel.svelte';
import type { LocalStore } from '../../lib/storage/LocalStore';

export interface ShortcutRow {
  id: CommandId;
  label: string;
  group: string;
}

/** Every command of the catalog with its current keys, searchable by name and keys. */
export class ShortcutListModel extends ListModel<ShortcutRow> {
  constructor(keymap: Keymap, isMac: boolean, store: LocalStore) {
    const groups: string[] = [...new Set(Object.values(SHORTCUTS).map((s) => s.group as string))];
    super(
      {
        id: 'shortcuts',
        load: async () => (Object.keys(SHORTCUTS) as CommandId[]).map((id) => ({ id, label: SHORTCUTS[id].label, group: SHORTCUTS[id].group })),
        defaultSort: { key: 'group', dir: 'asc' },
        searchText: (row) => `${row.label} ${row.group} ${KeySpec.text(keymap.keys(row.id), isMac)}`,
        columns: [
          { key: 'label', label: 'Befehl', value: (row) => row.label },
          { key: 'group', label: 'Bereich', value: (row) => `${groups.indexOf(row.group)}`.padStart(3, '0'), format: (row) => row.group, width: '10rem' },
          { key: 'keys', label: 'Tasten', value: (row) => keymap.keys(row.id), sortable: false, width: '12rem' },
          { key: 'actions', label: 'Aktionen', value: () => null, sortable: false, width: '15rem', align: 'end' },
        ],
        filters: [
          { key: 'group', label: 'Bereich', kind: 'select', allLabel: 'Alle Bereiche', options: () => groups.map((g) => ({ value: g, label: g })), test: (row, v) => row.group === v },
          { key: 'custom', label: 'Nur geänderte', kind: 'toggle', test: (row, on) => !on || keymap.isCustom(row.id) },
        ],
      },
      store,
    );
  }
}
