import { ListModel } from '../../lib/list/ListModel.svelte';
import type { LocalStore } from '../../lib/storage/LocalStore';
import type { Formatter } from '../../lib/time/Formatter';
import { RESPONSE_OPTIONS, responseLabel, type AttendanceEntry, type ResponseStatus } from './model';

const RANK: Readonly<Record<string, number>> = { YES: 0, MAYBE: 1, NO: 2, OPEN: 3 };

/** Who answered what for one appointment; data comes from the detail model. */
export class AttendanceListModel extends ListModel<AttendanceEntry> {
  constructor(load: () => Promise<AttendanceEntry[]>, format: () => Formatter, store: LocalStore) {
    super(
      {
        id: 'attendance',
        load,
        defaultSort: { key: 'status', dir: 'asc' },
        searchText: (e) => e.name,
        columns: [
          { key: 'name', label: 'Name', value: (e) => e.name },
          { key: 'status', label: 'Antwort', value: (e) => RANK[e.status ?? 'OPEN'], format: (e) => responseLabel(e.status), width: '8rem' },
          { key: 'reason', label: 'Begründung', value: (e) => e.reason, sortable: false, hideOnCompact: true },
          {
            key: 'updatedAt',
            label: 'Geantwortet',
            value: (e) => e.updatedAt,
            format: (e) => (e.updatedAt ? format().dateTime(e.updatedAt) : ''),
            width: '11rem',
            hideOnCompact: true,
          },
        ],
        filters: [
          {
            key: 'status',
            label: 'Antwort',
            kind: 'select',
            allLabel: 'Alle Antworten',
            options: () => [...RESPONSE_OPTIONS.map((o) => ({ value: o.value as string, label: o.label })), { value: 'OPEN', label: 'Offen' }],
            test: (e, value) => (e.status ?? 'OPEN') === (value as ResponseStatus | 'OPEN'),
          },
        ],
      },
      store,
    );
  }
}
