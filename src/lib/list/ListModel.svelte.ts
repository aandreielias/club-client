import { Resource } from '../state/Resource.svelte';
import type { LocalStore } from '../storage/LocalStore';

export type SortDirection = 'asc' | 'desc';

export interface ListSort {
  key: string;
  dir: SortDirection;
}

export interface ListColumn<T> {
  key: string;
  label: string;
  /** Sort and search value; null sorts last. */
  value: (item: T) => string | number | null;
  /** Display text when no custom cell renders this column (defaults to `value`). */
  format?: (item: T) => string;
  /** CSS width, e.g. '8rem'. */
  width?: string;
  align?: 'start' | 'end';
  sortable?: boolean;
  /** Dropped from the stacked phone layout. */
  hideOnCompact?: boolean;
}

export interface ListOption {
  value: string;
  label: string;
}

export interface ListFilter<T> {
  key: string;
  label: string;
  /** `select`: one of `options` ('' = all); `toggle`: on ('1') or off (''). */
  kind: 'select' | 'toggle';
  /** Receives the loaded items, so options can be derived from them. */
  options?: (items: readonly T[]) => readonly ListOption[];
  /** Label of the empty choice of a select filter. */
  allLabel?: string;
  /** Client-side test; omit for server filters (passed to `load` instead). */
  test?: (item: T, value: string) => boolean;
  /** Initial value. */
  initial?: string;
  /** Run the test also while the filter is off (e.g. "show inactive" hides inactive items when off). */
  always?: boolean;
}

export interface ListDefinition<T> {
  /** Key for the remembered filter and sort state. */
  id: string;
  columns: readonly ListColumn<T>[];
  filters?: readonly ListFilter<T>[];
  /** Loads the items; receives the values of server filters (those without `test`). */
  load: (server: Readonly<Record<string, string>>) => Promise<T[]>;
  defaultSort: ListSort;
  /** Text searched by the search field; omit to hide the search. */
  searchText?: (item: T) => string;
}

interface StoredState {
  filters: Record<string, string>;
  sort: ListSort;
}

/** Last keyboard row per list id, for the session (not stored). */
export class ListCursors {
  static readonly #rows = new Map<string, number>();

  static get(id: string): number {
    return ListCursors.#rows.get(id) ?? -1;
  }

  static set(id: string, row: number): void {
    ListCursors.#rows.set(id, row);
  }
}

/**
 * One list of the app: loading, search, filters and sorting, independent of what it lists.
 * Every list page builds one from a definition and renders it with DataTable.
 */
export class ListModel<T> {
  search = $state('');
  filters = $state<Record<string, string>>({});
  sort = $state<ListSort>({ key: '', dir: 'asc' });

  readonly data: Resource<T[]>;
  readonly rows: T[];

  constructor(
    readonly definition: ListDefinition<T>,
    private readonly store: LocalStore | null = null,
  ) {
    const stored = store?.get<StoredState>(this.storeKey);
    const initial = Object.fromEntries((definition.filters ?? []).map((f) => [f.key, f.initial ?? '']));
    this.filters = { ...initial, ...this.knownFilters(stored?.filters ?? {}) };
    this.sort = stored?.sort && this.column(stored.sort.key) ? stored.sort : definition.defaultSort;
    this.data = new Resource(() => definition.load(this.serverValues()));
    this.rows = $derived(this.compute(this.data.value ?? []));
  }

  get columns(): readonly ListColumn<T>[] {
    return this.definition.columns;
  }

  get filterDefinitions(): readonly ListFilter<T>[] {
    return this.definition.filters ?? [];
  }

  get searchable(): boolean {
    return !!this.definition.searchText;
  }

  get total(): number {
    return this.data.value?.length ?? 0;
  }

  load(): Promise<void> {
    return this.data.load();
  }

  /** Replaces the items locally (e.g. after a write answered with the new list). */
  set(items: T[]): void {
    this.data.set(items);
  }

  setFilter(key: string, value: string): void {
    const filter = this.filterDefinitions.find((f) => f.key === key);
    if (!filter || this.filters[key] === value) return;
    this.filters = { ...this.filters, [key]: value };
    this.persist();
    if (!filter.test) void this.load();
  }

  /** Same column flips the direction, another column starts ascending. */
  toggleSort(key: string): void {
    if (!this.column(key) || this.column(key)?.sortable === false) return;
    this.sort = this.sort.key === key ? { key, dir: this.sort.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' };
    this.persist();
  }

  setSort(sort: ListSort): void {
    if (!this.column(sort.key)) return;
    this.sort = sort;
    this.persist();
  }

  /** Clears search and filters (keeps the sort). */
  reset(): void {
    const hadServer = this.filterDefinitions.some((f) => !f.test && this.filters[f.key] !== (f.initial ?? ''));
    this.search = '';
    this.filters = Object.fromEntries(this.filterDefinitions.map((f) => [f.key, f.initial ?? '']));
    this.persist();
    if (hadServer) void this.load();
  }

  get activeFilters(): number {
    return this.filterDefinitions.filter((f) => (this.filters[f.key] ?? '') !== (f.initial ?? '')).length + (this.search.trim() ? 1 : 0);
  }

  column(key: string): ListColumn<T> | undefined {
    return this.columns.find((c) => c.key === key);
  }

  display(item: T, column: ListColumn<T>): string {
    if (column.format) return column.format(item);
    const value = column.value(item);
    return value === null ? '' : String(value);
  }

  private compute(items: readonly T[]): T[] {
    const needle = this.search.trim().toLocaleLowerCase();
    const searchText = this.definition.searchText;
    const clientFilters = this.filterDefinitions.filter((f) => f.test && (f.always || this.filters[f.key]));
    const filtered = items.filter(
      (item) =>
        (!needle || !searchText || searchText(item).toLocaleLowerCase().includes(needle)) &&
        clientFilters.every((f) => f.test!(item, this.filters[f.key])),
    );
    const column = this.column(this.sort.key);
    if (!column) return filtered;
    const factor = this.sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => ListModel.compare(column.value(a), column.value(b), factor));
  }

  /** Nulls always last, numbers numerically, text by locale with numeric awareness. */
  static compare(a: string | number | null, b: string | number | null, factor: 1 | -1): number {
    if (a === b) return 0;
    if (a === null || a === '') return 1;
    if (b === null || b === '') return -1;
    if (typeof a === 'number' && typeof b === 'number') return (a - b) * factor;
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }) * factor;
  }

  private serverValues(): Record<string, string> {
    return Object.fromEntries(this.filterDefinitions.filter((f) => !f.test).map((f) => [f.key, this.filters[f.key] ?? '']));
  }

  private knownFilters(values: Record<string, string>): Record<string, string> {
    return Object.fromEntries(Object.entries(values).filter(([key]) => this.filterDefinitions.some((f) => f.key === key)));
  }

  private get storeKey(): string {
    return `list.${this.definition.id}`;
  }

  private persist(): void {
    this.store?.set(this.storeKey, { filters: this.filters, sort: this.sort } satisfies StoredState);
  }
}
