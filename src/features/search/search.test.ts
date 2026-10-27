import { describe, expect, it } from 'vitest';
import '../../lib/mock';
import { mockServer } from '../../lib/mock/MockServer';
import { hitTarget, type SearchHit } from './model';
import { SearchListModel } from './SearchListModel.svelte';

const search = async (who: string, q: string) =>
  ((await mockServer.handle('GET', `/api/v1/search?q=${encodeURIComponent(q)}`, null, `${who}@example.at`)) as { hits: SearchHit[] }).hits;

describe('global search (mock)', () => {
  it('finds records of every kind the member may see', async () => {
    const kinds = (hits: SearchHit[]) => [...new Set(hits.map((h) => h.kind))];
    expect(kinds(await search('vorstand', 'damen'))).toEqual(expect.arrayContaining(['APPOINTMENT', 'TEAM', 'ITEM', 'FOLDER']));
    expect((await search('vorstand', 'bälle')).map((h) => h.kind)).toEqual(expect.arrayContaining(['TASK', 'ITEM']));
    expect((await search('vorstand', 'budget')).map((h) => h.title)).toEqual(['Budget 2027.xlsx']);
    expect(await search('spielerin', 'budget')).toEqual([]); // board folder
    expect((await search('vorstand', 'training damen')).map((h) => h.title)).toEqual(['Training Damen 1', 'Training Damen 1']); // two series
  });

  it('finds only member profiles the searcher may open', async () => {
    expect(
      (await search('trainer', 'spieler'))
        .filter((h) => h.kind === 'MEMBER')
        .map((h) => h.id)
        .sort(),
    ).toEqual(['spieler', 'spielerin']);
    expect((await search('spielerin', 'spieler')).filter((h) => h.kind === 'MEMBER').map((h) => h.id)).toEqual(['spielerin']);
    expect((await search('eltern', 'david')).filter((h) => h.kind === 'MEMBER').map((h) => h.id)).toEqual(['spieler']); // own minor
  });

  it('refuses too short queries', async () => {
    await expect(search('vorstand', 'a')).rejects.toMatchObject({ code: 'search.query-invalid' });
    expect(SearchListModel.searchable(' a ')).toBe(false);
    expect(SearchListModel.searchable('ab')).toBe(true);
  });

  it('opens records in the window and folders on the files page', () => {
    const base = { title: 't', detail: null, at: null, folderId: null };
    expect(hitTarget({ ...base, kind: 'TEAM', id: 'x' })).toEqual({ window: { kind: 'team', id: 'x' } });
    expect(hitTarget({ ...base, kind: 'FILE', id: 'f', folderId: 'd' })).toEqual({ window: { kind: 'file', id: 'd:f' } });
    expect(hitTarget({ ...base, kind: 'FOLDER', id: 'd' })).toEqual({ path: '/files/d' });
  });
});
