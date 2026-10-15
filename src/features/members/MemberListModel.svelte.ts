import { ListModel } from '../../lib/list/ListModel.svelte';
import type { LocalStore } from '../../lib/storage/LocalStore';
import { ROLE_LABELS, type Member, type Role } from '../../lib/types';
import type { MembersApi } from './MembersApi';

/** The member list (admin/board): search, role filter, inactive members on request. */
export class MemberListModel extends ListModel<Member> {
  constructor(api: MembersApi, store: LocalStore | null = null) {
    super(
      {
        id: 'members',
        load: () => api.list(),
        defaultSort: { key: 'name', dir: 'asc' },
        searchText: (m) => `${m.firstName} ${m.lastName} ${m.email}`,
        columns: [
          { key: 'name', label: 'Name', value: (m) => `${m.lastName} ${m.firstName}`, format: (m) => `${m.lastName}, ${m.firstName}` },
          { key: 'email', label: 'E-Mail', value: (m) => m.email, hideOnCompact: true },
          { key: 'roles', label: 'Rollen', value: (m) => m.roles.map((r) => ROLE_LABELS[r]).join(', '), sortable: false },
          { key: 'status', label: 'Status', value: (m) => (m.active ? 'Aktiv' : 'Inaktiv'), width: '7rem' },
        ],
        filters: [
          {
            key: 'role',
            label: 'Rolle',
            kind: 'select',
            allLabel: 'Alle Rollen',
            options: () => Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label })),
            test: (m, value) => m.roles.includes(value as Role),
          },
          { key: 'inactive', label: 'Inaktive zeigen', kind: 'toggle', always: true, test: (m, on) => !!on || m.active },
        ],
      },
      store,
    );
  }

  get activeCount(): number {
    return (this.data.value ?? []).filter((m) => m.active).length;
  }
}
