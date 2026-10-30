import { ListModel } from '../../lib/list/ListModel.svelte';
import type { LocalStore } from '../../lib/storage/LocalStore';
import { ROLE_LABELS, type Member, type Role } from '../../lib/types';
import type { MembersApi } from './MembersApi';

type FamilyFilter = 'minor' | 'ward' | 'guardian';

/** The member list (admin/board): search, role and family filters, inactive members on request. */
export class MemberListModel extends ListModel<Member> {
  constructor(api: MembersApi, store: LocalStore | null = null) {
    // Filled with each load; the family filter reads it (birth dates are hidden from board members, so the server tells).
    const family: Record<FamilyFilter, Set<string>> = { minor: new Set(), ward: new Set(), guardian: new Set() };
    // Invited and never signed in; an older server or a failing call shows plain "Aktiv".
    let pending = new Set<string>();
    super(
      {
        id: 'members',
        load: async () => {
          const [list, invited] = await Promise.all([api.list(), api.pendingInvitations().catch(() => [] as string[])]);
          pending = new Set(invited);
          family.minor = new Set(list.minorIds);
          family.ward = new Set(list.wardIds);
          family.guardian = new Set(list.guardianIds);
          return list.items;
        },
        defaultSort: { key: 'name', dir: 'asc' },
        searchText: (m) => `${m.firstName} ${m.lastName} ${m.email}`,
        columns: [
          { key: 'name', label: 'Name', value: (m) => `${m.lastName} ${m.firstName}`, format: (m) => `${m.lastName}, ${m.firstName}` },
          { key: 'email', label: 'E-Mail', value: (m) => m.email, hideOnCompact: true },
          { key: 'roles', label: 'Rollen', value: (m) => m.roles.map((r) => ROLE_LABELS[r]).join(', '), sortable: false },
          { key: 'status', label: 'Status', value: (m) => (!m.active ? 'Inaktiv' : pending.has(m.id) ? 'Eingeladen' : 'Aktiv'), width: '7rem' },
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
          {
            key: 'family',
            label: 'Familie',
            kind: 'select',
            allLabel: 'Alle',
            options: () => [
              { value: 'minor', label: 'Minderjährige' },
              { value: 'ward', label: 'Kinder (mit Erziehungsberechtigten)' },
              { value: 'guardian', label: 'Erziehungsberechtigte' },
            ],
            test: (m, value) => family[value as FamilyFilter]?.has(m.id) ?? true,
          },
          {
            key: 'invited',
            label: 'Einladung',
            kind: 'select',
            allLabel: 'Alle',
            options: () => [
              { value: 'pending', label: 'Noch nicht angemeldet' },
              { value: 'signed', label: 'Angemeldet' },
            ],
            test: (m, value) => (value === 'pending' ? pending.has(m.id) : !pending.has(m.id)),
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
