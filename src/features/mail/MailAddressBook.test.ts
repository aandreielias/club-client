import { describe, expect, it } from 'vitest';
import { MailAddressBook } from './MailAddressBook.svelte';

const book = () =>
  new MailAddressBook({
    entries: async () => [
      { address: 'anna.admin@club.at', name: 'Anna Admin', memberId: 'anna', role: null },
      { address: 'david.spieler@club.at', name: 'David Spieler', memberId: 'david', role: null },
      { address: 'vorstand@club.at', name: 'Vorstand', memberId: null, role: 'BOARD' },
    ],
    teams: async () => [{ id: 't1', name: 'Damen 1' }],
    members: async () => ['david', 'nobody'],
  });

describe('MailAddressBook', () => {
  it('suggests club addresses by name or address, without chosen ones', async () => {
    const hits = await book().suggest('ann', ['david.spieler@club.at']);
    expect(hits.map((h) => h.value)).toEqual(['anna.admin@club.at']);
    expect((await book().suggest('vorst', [])).map((h) => h.label)).toEqual(['Vorstand <vorstand@club.at>']);
  });

  it('offers what was typed when it is a new address, and several at once', async () => {
    expect((await book().suggest('Ext@Example.com', []))[0]).toEqual({ value: 'ext@example.com', label: 'ext@example.com übernehmen' });
    expect((await book().suggest('a@b.at, c@d.at', []))[0]).toEqual({ value: 'a@b.at,c@d.at', label: '2 Adressen übernehmen' });
    expect(await book().suggest('kein', [])).toEqual([]);
  });

  it('turns a team into the club addresses of its members', async () => {
    const b = book();
    const [team] = await b.suggest('damen', []);
    expect(team.value).toBe('team:t1');
    expect(await b.resolve(team.value)).toEqual(['david.spieler@club.at']);
    expect(await b.resolve('a@b.at,C@d.at')).toEqual(['a@b.at', 'c@d.at']);
  });
});
