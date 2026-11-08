import { ListModel } from '../../lib/list/ListModel.svelte';
import type { LocalStore } from '../../lib/storage/LocalStore';
import { ROLE_LABELS, type Member, type OtherMember, type Role } from '../../lib/types';
import type { MembersApi } from './MembersApi';

type FamilyFilter = 'minor' | 'ward' | 'guardian';

/** A row: a member in full, or (`nameOnly`) one the viewer may not open, shown by name. */
export type MemberRow = Member & { nameOnly?: true };

const nameOnly = ({ id, firstName, lastName }: OtherMember): MemberRow => ({
  id,
  firstName,
  lastName,
  middleName: null,
  email: null,
  birthDate: null,
  phone: null,
  photoConsent: false,
  active: true,
  roles: [],
  membershipTypes: [],
  previousType: null,
  memberSince: null,
  voter: false,
  eligible: false,
  login: true,
  nameOnly: true,
});

/**
 * The member list: search, role and family filters, inactive members on request. Admin/board (`board`) also see the account
 * state; everyone else sees the profiles they may open in full and the other members by name (server: MemberHandlers.list).
 */
export class MemberListModel extends ListModel<MemberRow> {
  constructor(api: MembersApi, store: LocalStore | null = null, board = true) {
    // Filled with each load; the family filter reads it (birth dates are hidden from board members, so the server tells).
    const family: Record<FamilyFilter, Set<string>> = { minor: new Set(), ward: new Set(), guardian: new Set() };
    // Invited and never signed in; an older server or a failing call shows plain "Aktiv".
    let pending = new Set<string>();
    super(
      {
        id: 'members',
        load: async () => {
          const [list, invited] = await Promise.all([api.list(), board ? api.pendingInvitations().catch(() => [] as string[]) : []]);
          pending = new Set(invited);
          family.minor = new Set(list.minorIds);
          family.ward = new Set(list.wardIds);
          family.guardian = new Set(list.guardianIds);
          return [...list.items, ...list.others.map(nameOnly)];
        },
        defaultSort: { key: 'name', dir: 'asc' },
        searchText: (m) => `${m.firstName} ${m.lastName} ${m.email ?? ''}`,
        columns: [
          { key: 'name', label: 'Name', value: (m) => `${m.lastName} ${m.firstName}`, format: (m) => `${m.lastName}, ${m.firstName}` },
          { key: 'email', label: 'E-Mail', value: (m) => m.email ?? '', format: (m) => m.email ?? 'ohne Login', hideOnCompact: true },
          { key: 'roles', label: 'Rollen', value: (m) => m.roles.map((r) => ROLE_LABELS[r]).join(', '), sortable: false },
          // The account state is for admin/board (coaches may not read invitations).
          ...(board
            ? [
                {
                  key: 'status',
                  label: 'Status',
                  value: (m: MemberRow) => (!m.active ? 'Inaktiv' : !m.login ? 'Ohne Login' : pending.has(m.id) ? 'Eingeladen' : 'Aktiv'),
                  width: '7rem',
                },
              ]
            : []),
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
            allLabel: 'Alle Mitglieder',
            options: () => [
              { value: 'minor', label: 'Minderjährige' },
              { value: 'ward', label: 'Kinder (mit Erziehungsberechtigten)' },
              { value: 'guardian', label: 'Erziehungsberechtigte' },
            ],
            test: (m, value) => family[value as FamilyFilter]?.has(m.id) ?? true,
          },
          ...(board
            ? [
                {
                  key: 'invited',
                  label: 'Einladung',
                  kind: 'select' as const,
                  allLabel: 'Jede Einladung',
                  options: () => [
                    { value: 'pending', label: 'Noch nicht angemeldet' },
                    { value: 'signed', label: 'Angemeldet' },
                    { value: 'none', label: 'Ohne Login' },
                  ],
                  test: (m: MemberRow, value: string) =>
                    value === 'pending' ? pending.has(m.id) : value === 'none' ? !m.login : m.login && !pending.has(m.id),
                },
              ]
            : []),
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
