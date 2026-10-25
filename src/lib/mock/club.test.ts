import { describe, expect, it } from 'vitest';
import { directory, MockDirectory } from './core';
import type { Member } from '../types';

const member = (id: string): Member => directory.members.data.find((m) => m.id === id)!;

describe('mock club facts', () => {
  it('lets the board edit them with a step-up; blank values fall back to club.yml', () => {
    expect(() => directory.updateClub(member('spieler'), { name: 'X' })).toThrow();
    directory.stepUp(member('vorstand'), MockDirectory.PIN);
    expect(() => directory.updateClub(member('vorstand'), { seasonStartMonth: 13 })).toThrow();
    expect(directory.updateClub(member('vorstand'), { name: 'VC Beispiel', registerNumber: '123', seasonStartMonth: 8 })).toMatchObject({
      name: 'VC Beispiel', shortName: 'SDG', registerNumber: '123', seasonStartMonth: 8 });
    expect(directory.updateClub(member('vorstand'), { name: ' ' })).toMatchObject({ name: 'Soli Deo Gloria', registerNumber: null, seasonStartMonth: 7 });
  });
});
