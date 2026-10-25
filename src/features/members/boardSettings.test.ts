import { describe, expect, it } from 'vitest';
import { directory, MockDirectory } from '../../lib/mock/core';
import type { Member } from '../../lib/types';
import { meetings } from '../meetings/mock';
import { boardWarning } from './messages';

const member = (id: string): Member => directory.members.data.find((m) => m.id === id)!;

describe('club rules for offices and resolutions', () => {
  it('rename offices, change holders and word the board warnings with them', () => {
    directory.stepUp(member('vorstand'), MockDirectory.PIN);
    const before = structuredClone(directory.boardSettings.data);
    const changed = structuredClone(before);
    changed.offices[0].label = 'Obfrau';
    changed.offices[5].minHolders = 1;
    changed.minBoardSize = 5;
    expect(() => directory.saveBoardSettings(member('spielerin'), changed)).toThrow();
    expect(() => directory.saveBoardSettings(member('vorstand'), { ...changed, offices: changed.offices.slice(1) })).toThrow();
    const saved = directory.saveBoardSettings(member('vorstand'), changed);
    expect(boardWarning('board.too-small', saved)).toBe('Der Vorstand braucht mindestens 5 Personen.');
    expect(boardWarning('board.chair-missing', saved)).toBe('Obfrau ist nicht besetzt.');
    expect(boardWarning('board.auditors-missing', before)).toBe('Rechnungsprüfung: es braucht 2 Personen.');
    directory.saveBoardSettings(member('vorstand'), before);
  });

  it('fix majorities per decision only where every meeting type offers them', () => {
    directory.stepUp(member('vorstand'), MockDirectory.PIN);
    const before = structuredClone(meetings.rules.data);
    const exclusion = before.map((r) => (r.action === 'EXCLUSION' ? { ...r, majority: 'SIMPLE' as const } : r));
    expect(() => meetings.saveRules(member('vorstand'), { items: exclusion })).toThrow(); // the extraordinary board meeting needs three quarters
    const wrongKind = before.map((r) => (r.action === 'GENERAL' ? { ...r, followUps: [{ id: null, kind: 'ENTER_OFFICE', title: 'x', dueDays: null }] } : r));
    expect(() => meetings.saveRules(member('vorstand'), { items: wrongKind })).toThrow();
    const extra = before.map((r) => (r.action === 'GENERAL' ? { ...r, followUps: [...r.followUps, { id: null, kind: 'IMPLEMENT', title: 'Protokoll: {beschluss}', dueDays: 3 }] } : r));
    expect(meetings.saveRules(member('vorstand'), { items: extra }).items.find((r) => r.action === 'GENERAL')!.followUps).toHaveLength(2);
    meetings.saveRules(member('vorstand'), { items: before });
  });
});
