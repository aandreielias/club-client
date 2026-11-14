import { api, bus, session } from '../../lib/container';
import { CatalogStore } from '../../lib/state/CatalogStore.svelte';
import { FINANCE_CHANGED } from './events';
import { FinanceApi } from './FinanceApi';
import { formatMoney, reaches, type Account, type AccountInput, type Category, type CategoryInput } from './model';

/** Buchhaltung services, created once and shared by its views. */
export const financeApi = new FinanceApi(api);

/** The club's accounts with their balances (server: finance_account). */
export const accounts = new CatalogStore<string, Account, AccountInput>(() => financeApi.accounts(), bus, FINANCE_CHANGED, [], {
  save: (key, input) => financeApi.saveAccount(key, input),
  delete: (key) => financeApi.deleteAccount(key),
});

/** The club's categories of bookings (server: finance_category). */
export const categories = new CatalogStore<string, Category, CategoryInput>(() => financeApi.categories(), bus, FINANCE_CHANGED, [], {
  save: (key, input) => financeApi.saveCategory(key, input),
  delete: (key) => financeApi.deleteCategory(key),
});

/** The member's Buchhaltung level reaches `min` (server: FinanceAccess.require). */
export const financeMay = (min: 'READ' | 'AUDIT' | 'WRITE'): boolean => reaches(session.me?.financeAccess, min);

/** An amount in the club's currency and locale. */
export const money = (cents: number): string => formatMoney(cents, session.club?.currency ?? 'EUR', session.club?.locale ?? 'de-AT');
