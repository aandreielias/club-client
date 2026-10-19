import { describe, expect, it, vi } from 'vitest';
import { LocalStore } from '../storage/LocalStore';
import { ListModel, type ListDefinition } from './ListModel.svelte';

interface Item {
  id: string;
  name: string;
  size: number | null;
  team: string;
}

const items: Item[] = [
  { id: '1', name: 'Bälle 10', size: 3, team: 'a' },
  { id: '2', name: 'Bälle 9', size: null, team: 'b' },
  { id: '3', name: 'Netz', size: 1, team: 'a' },
];

function definition(load = vi.fn(async (_server: Readonly<Record<string, string>>) => items)): ListDefinition<Item> {
  return {
    id: 'test',
    load,
    defaultSort: { key: 'name', dir: 'asc' },
    searchText: (i) => i.name,
    columns: [
      { key: 'name', label: 'Name', value: (i) => i.name },
      { key: 'size', label: 'Größe', value: (i) => i.size },
    ],
    filters: [
      { key: 'team', label: 'Team', kind: 'select', options: () => [], test: (i, v) => i.team === v },
      { key: 'scope', label: 'Alle', kind: 'toggle' },
    ],
  };
}

function memoryStore(): LocalStore {
  const data = new Map<string, unknown>();
  return { get: (k: string) => data.get(k) ?? null, set: (k: string, v: unknown) => data.set(k, structuredClone(v)) } as unknown as LocalStore;
}

describe('ListModel', () => {
  it('sorts text with numeric awareness and puts empty values last', async () => {
    const list = new ListModel(definition());
    await list.load();
    expect(list.rows.map((i) => i.id)).toEqual(['2', '1', '3']); // "Bälle 9" before "Bälle 10"
    list.toggleSort('size');
    expect(list.rows.map((i) => i.id)).toEqual(['3', '1', '2']);
    list.toggleSort('size');
    expect(list.rows.map((i) => i.id)).toEqual(['1', '3', '2']);
  });

  it('filters on the client, searches and counts active filters', async () => {
    const list = new ListModel(definition());
    await list.load();
    list.setFilter('team', 'a');
    expect(list.rows.map((i) => i.id)).toEqual(['1', '3']);
    list.search = 'netz';
    expect(list.rows.map((i) => i.id)).toEqual(['3']);
    expect(list.activeFilters).toBe(2);
    list.reset();
    expect(list.rows).toHaveLength(3);
  });

  it('reloads with the values of server filters', async () => {
    const load = vi.fn(async (_server: Readonly<Record<string, string>>) => items);
    const list = new ListModel(definition(load));
    await list.load();
    list.setFilter('scope', '1');
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    expect(load.mock.calls[1][0]).toEqual({ scope: '1' });
    list.setFilter('team', 'b'); // client filter: no reload
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('remembers filters and sort per list', async () => {
    const store = memoryStore();
    const first = new ListModel(definition(), store);
    first.setFilter('team', 'b');
    first.toggleSort('size');
    const second = new ListModel(definition(), store);
    expect(second.filters.team).toBe('b');
    expect(second.sort).toEqual({ key: 'size', dir: 'asc' });
  });
});

describe('ListModel multi filters', () => {
  const tagged = [
    { id: 'p1', people: ['anna', 'ben'] },
    { id: 'p2', people: ['anna'] },
    { id: 'p3', people: [] as string[] },
  ];
  const people = (store: LocalStore) =>
    new ListModel(
      {
        id: 'photos',
        load: async () => tagged,
        defaultSort: { key: 'id', dir: 'asc' },
        columns: [{ key: 'id', label: 'Id', value: (p) => p.id }],
        filters: [{ key: 'people', label: 'Personen', kind: 'multi', transient: true, test: (p, v) => v.split(',').every((id) => p.people.includes(id)) }],
      },
      store,
    );

  it('keeps rows showing all chosen people and does not remember them', async () => {
    const store = memoryStore();
    const list = people(store);
    await list.load();
    list.setFilter('people', 'anna');
    expect(list.rows.map((p) => p.id)).toEqual(['p1', 'p2']);
    list.setFilter('people', 'anna,ben');
    expect(list.rows.map((p) => p.id)).toEqual(['p1']);
    const again = people(store);
    await again.load();
    expect(again.rows).toHaveLength(3);
  });
});
