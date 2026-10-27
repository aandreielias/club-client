import { describe, expect, it } from 'vitest';
import { board } from './mock';
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
    changed.minBoardSize = 5;
    expect(() => board.saveBoardSettings(member('spielerin'), changed)).toThrow();
    expect(() => board.saveBoardSettings(member('vorstand'), { ...changed, offices: changed.offices.slice(1) })).toThrow();
    const saved = board.saveBoardSettings(member('vorstand'), changed);
    expect(boardWarning('board.too-small', saved)).toBe('Der Vorstand braucht mindestens 5 Personen.');
    expect(boardWarning('board.chair-missing', saved)).toBe('Obfrau ist nicht besetzt.');
    expect(boardWarning('board.auditors-missing', before)).toBe('Rechnungsprüfung: es braucht 2 Personen.');
    board.saveBoardSettings(member('vorstand'), before);
  });

  it('fix majorities per decision only where every meeting type offers them', () => {
    directory.stepUp(member('vorstand'), MockDirectory.PIN);
    const before = structuredClone(meetings.rules.data);
    const exclusion = before.map((r) => (r.action === 'EXCLUSION' ? { ...r, majority: 'SIMPLE' as const } : r));
    expect(() => meetings.saveRules(member('vorstand'), { items: exclusion, circular: meetings.circular.data })).toThrow(); // the extraordinary board meeting needs three quarters
    const wrongKind = before.map((r) => (r.action === 'GENERAL' ? { ...r, followUps: [{ id: null, kind: 'ENTER_OFFICE', title: 'x', dueDays: null }] } : r));
    expect(() => meetings.saveRules(member('vorstand'), { items: wrongKind, circular: meetings.circular.data })).toThrow();
    const extra = before.map((r) => (r.action === 'GENERAL' ? { ...r, followUps: [...r.followUps, { id: null, kind: 'IMPLEMENT', title: 'Protokoll: {beschluss}', dueDays: 3 }] } : r));
    expect(meetings.saveRules(member('vorstand'), { items: extra, circular: meetings.circular.data }).items.find((r) => r.action === 'GENERAL')!.followUps).toHaveLength(2);
    expect(() => meetings.saveRules(member('vorstand'), { items: before, circular: { minHours: 0, quorum: 'MORE_THAN_HALF' } })).toThrow();
    meetings.saveRules(member('vorstand'), { items: before, circular: meetings.circular.data });
  });

  it('let the club define membership kinds and office pairs, and keep office holders eligible', () => {
    directory.stepUp(member('vorstand'), MockDirectory.PIN);
    const supporter = board.saveMembershipKind(member('vorstand'), null, { label: 'Unterstützend', votes: true, eligible: false, sort: 5 });
    const target = member('spielerin');
    expect(directory.setMembership(member('vorstand'), target.id, { membershipType: supporter.key })).toMatchObject({ voter: true, eligible: false });
    expect(() => directory.setMembership(member('vorstand'), target.id, { membershipType: 'NOPE' })).toThrow();
    expect(() => board.deleteMembershipKind(member('vorstand'), supporter.key)).toThrow();
    const settings = structuredClone(directory.boardSettings.data);
    expect(() => board.saveBoardSettings(member('vorstand'), { ...settings, combinations: [{ a: 'CHAIR', b: 'CHAIR' }] })).toThrow();
    board.saveBoardSettings(member('vorstand'), { ...settings, combinations: [] });
    expect(directory.boardSettings.data.combinations).toEqual([]);
    board.saveBoardSettings(member('vorstand'), settings);
    directory.setMembership(member('vorstand'), target.id, { membershipType: null });
    board.deleteMembershipKind(member('vorstand'), supporter.key);
  });
});

