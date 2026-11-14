import { ListModel } from '../../lib/list/ListModel.svelte';
import type { LocalStore } from '../../lib/storage/LocalStore';
import type { FinanceApi } from './FinanceApi';
import { seasonLabel, type Booking } from './model';

interface Lookups {
  account: (key: string) => string;
  category: (key: string) => string;
  money: (cents: number) => string;
  date: (day: string) => string;
  /** The account and category pickers. */
  accounts: () => readonly { value: string; label: string }[];
  categories: () => readonly { value: string; label: string }[];
}

/** The journal of one season (asked from the server; '' = the running one), account and category filtered here. */
export class JournalListModel extends ListModel<Booking> {
  /** The server cut the season (more than its cap). */
  truncated = $state(false);

  constructor(api: FinanceApi, current: number, startMonth: number, look: Lookups, store: LocalStore | null) {
    const seasons = Array.from({ length: 5 }, (_, i) => current - 1 - i);
    super(
      {
        id: 'finance-journal',
        load: async (server) => {
          const list = await api.bookings(server.season ? Number(server.season) : current);
          this.truncated = list.truncated;
          return list.items;
        },
        defaultSort: { key: 'date', dir: 'desc' },
        searchText: (b) => `${b.text} ${b.note ?? ''} ${look.account(b.account)} ${b.category ? look.category(b.category) : 'Umbuchung'}`,
        columns: [
          { key: 'date', label: 'Datum', value: (b) => b.bookedOn, format: (b) => look.date(b.bookedOn), width: '7rem' },
          { key: 'text', label: 'Text', value: (b) => b.text },
          {
            key: 'category',
            label: 'Kategorie',
            value: (b) =>
              b.category ? look.category(b.category) : `Umbuchung ${b.amountCents < 0 ? '→' : '←'} ${look.account(b.transferAccount ?? '')}`,
            width: '12rem',
            hideOnCompact: true,
          },
          { key: 'account', label: 'Konto', value: (b) => look.account(b.account), width: '9rem', hideOnCompact: true },
          { key: 'amount', label: 'Betrag', value: (b) => b.amountCents, format: (b) => look.money(b.amountCents), width: '8rem', align: 'end' },
        ],
        filters: [
          {
            key: 'season',
            label: 'Saison',
            kind: 'select',
            allLabel: `Saison ${seasonLabel(current, startMonth)}`,
            options: () => seasons.map((s) => ({ value: String(s), label: `Saison ${seasonLabel(s, startMonth)}` })),
            transient: true,
          },
          {
            key: 'account',
            label: 'Konto',
            kind: 'select',
            allLabel: 'Alle Konten',
            options: () => look.accounts(),
            test: (b, v) => b.account === v,
          },
          {
            key: 'category',
            label: 'Kategorie',
            kind: 'select',
            allLabel: 'Alle Kategorien',
            options: () => [{ value: '-', label: 'Umbuchungen' }, ...look.categories()],
            test: (b, v) => (v === '-' ? !b.category : b.category === v),
          },
        ],
      },
      store,
    );
  }
}
