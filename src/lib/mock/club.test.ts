import { describe, expect, it } from 'vitest';
import { directory, MockDirectory } from './core';
import type { Member } from '../types';

const member = (id: string): Member => directory.members.data.find((m) => m.id === id)!;

describe('mock club facts', () => {
  it('are set up once by an admin, then edited by the board with a step-up; blank values fall back to club.yml', () => {
    expect(directory.clubInfo()).toMatchObject({ name: 'Mein Verein', configured: false });
    expect(() => directory.updateClub(member('vorstand'), { name: 'X' })).toThrow(); // the first setup is the admin's
    expect(directory.updateClub(member('admin'), { name: 'VC Beispiel' })).toMatchObject({ name: 'VC Beispiel', configured: true });

    expect(() => directory.updateClub(member('spieler'), { name: 'X' })).toThrow();
    directory.stepUp(member('vorstand'), MockDirectory.PIN);
    expect(() => directory.updateClub(member('vorstand'), { seasonStartMonth: 13 })).toThrow();
    expect(directory.updateClub(member('vorstand'), { name: 'VC Beispiel', registerNumber: '123', seasonStartMonth: 8 })).toMatchObject({
      name: 'VC Beispiel', shortName: 'Verein', registerNumber: '123', seasonStartMonth: 8 });
    expect(directory.updateClub(member('vorstand'), { name: ' ' })).toMatchObject({ name: 'Mein Verein', registerNumber: null, seasonStartMonth: 7 });
  });
});
