import { describe, expect, it } from 'vitest';
import { board } from './mock';
import { directory } from '../../lib/mock/core';
import type { Member } from '../../lib/types';
import { meetings } from '../meetings/mock';
import { boardWarning } from './messages';

const member = (id: string): Member => directory.members.data.find((m) => m.id === id)!;

describe('club rules for offices and resolutions', () => {
  it('rename offices, change holders and word the board warnings with them', () => {
    directory.confirm(member('vorstand'));
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
    directory.confirm(member('vorstand'));
    const before = structuredClone(meetings.rules.data);
    const exclusion = before.map((r) => (r.action === 'EXCLUSION' ? { ...r, majority: 'SIMPLE' as const } : r));
    expect(() => meetings.saveRules(member('vorstand'), { items: exclusion, circular: meetings.circular.data })).toThrow(); // the extraordinary board meeting needs three quarters
    const wrongKind = before.map((r) =>
      r.action === 'GENERAL' ? { ...r, followUps: [{ id: null, kind: 'ENTER_OFFICE', title: 'x', dueDays: null }] } : r,
    );
    expect(() => meetings.saveRules(member('vorstand'), { items: wrongKind, circular: meetings.circular.data })).toThrow();
    const extra = before.map((r) =>
      r.action === 'GENERAL'
        ? { ...r, followUps: [...r.followUps, { id: null, kind: 'IMPLEMENT', title: 'Protokoll: {beschluss}', dueDays: 3 }] }
        : r,
    );
    expect(
      meetings.saveRules(member('vorstand'), { items: extra, circular: meetings.circular.data }).items.find((r) => r.action === 'GENERAL')!.followUps,
    ).toHaveLength(2);
    expect(() => meetings.saveRules(member('vorstand'), { items: before, circular: { minHours: 0, quorum: 'MORE_THAN_HALF' } })).toThrow();
    meetings.saveRules(member('vorstand'), { items: before, circular: meetings.circular.data });
  });

  it('remove a decision from every meeting type, but never the general one', () => {
    directory.confirm(member('vorstand'));
    const before = structuredClone(meetings.rules.data);
    const types = structuredClone(meetings.types.data);
    const removed = before.map((r) => (r.action === 'EXCLUSION' || r.action === 'GENERAL' ? { ...r, enabled: false } : r));
    const saved = meetings.saveRules(member('vorstand'), { items: removed, circular: meetings.circular.data });
    expect(saved.items.find((r) => r.action === 'GENERAL')!.enabled).toBe(true);
    expect(meetings.types.data.some((t) => t.actions.includes('EXCLUSION'))).toBe(false);
    const extraBoard = types.find((t) => t.key === 'EXTRA_BOARD')!;
    expect(() => meetings.saveType(member('vorstand'), 'EXTRA_BOARD', extraBoard)).toThrow(
      expect.objectContaining({ code: 'meeting-type.action-removed' }),
    );
    meetings.saveRules(member('vorstand'), { items: before, circular: meetings.circular.data });
    meetings.types.data.splice(0, meetings.types.data.length, ...types);
  });

  it('let the club define membership kinds and office pairs, and keep office holders eligible', () => {
    directory.confirm(member('vorstand'));
    const supporter = board.saveMembershipKind(member('vorstand'), null, { label: 'Unterstützend', votes: true, eligible: false, sort: 5 });
    const target = member('spielerin');
    expect(directory.setMembership(member('vorstand'), target.id, { membershipTypes: [supporter.key] })).toMatchObject({
      voter: true,
      eligible: false,
    });
    expect(() => directory.setMembership(member('vorstand'), target.id, { membershipTypes: ['NOPE'] })).toThrow();
    expect(() => board.deleteMembershipKind(member('vorstand'), supporter.key)).toThrow();
    const settings = structuredClone(directory.boardSettings.data);
    expect(() => board.saveBoardSettings(member('vorstand'), { ...settings, combinations: [{ a: 'CHAIR', b: 'CHAIR' }] })).toThrow();
    board.saveBoardSettings(member('vorstand'), { ...settings, combinations: [] });
    expect(directory.boardSettings.data.combinations).toEqual([]);
    board.saveBoardSettings(member('vorstand'), settings);
    directory.setMembership(member('vorstand'), target.id, { membershipTypes: [] });
    board.deleteMembershipKind(member('vorstand'), supporter.key);
  });
});

describe('membership kinds per member', () => {
  it('honour with one kind and restore it, or hold several when the club allows it', () => {
    directory.confirm(member('vorstand'));
    directory.setMembership(member('vorstand'), 'spielerin', { membershipTypes: ['ORDINARY'] });
    expect(directory.setMembership(member('vorstand'), 'spielerin', { membershipTypes: ['HONORARY'] })).toMatchObject({
      membershipTypes: ['HONORARY'],
      previousType: 'ORDINARY',
      voter: true,
    });
    expect(() => directory.setMembership(member('vorstand'), 'spielerin', { membershipTypes: ['HONORARY', 'ORDINARY'] })).toThrow(
      expect.objectContaining({ code: 'member.several-kinds' }),
    );
    expect(directory.setMembership(member('vorstand'), 'spielerin', { membershipTypes: ['ORDINARY'] })).toMatchObject({ previousType: null });

    const settings = structuredClone(directory.boardSettings.data);
    board.saveBoardSettings(member('vorstand'), { ...settings, multipleKinds: true });
    expect(directory.setMembership(member('vorstand'), 'spielerin', { membershipTypes: ['HONORARY', 'ORDINARY'] })).toMatchObject({
      membershipTypes: ['ORDINARY', 'HONORARY'],
      previousType: null,
    });
    expect(() => board.saveBoardSettings(member('vorstand'), settings)).toThrow(expect.objectContaining({ code: 'member.several-kinds' }));
    directory.setMembership(member('vorstand'), 'spielerin', { membershipTypes: ['ORDINARY'] });
    board.saveBoardSettings(member('vorstand'), settings);
    expect(() => board.deleteMembershipKind(member('vorstand'), 'HONORARY')).toThrow(expect.objectContaining({ code: 'membership-kind.fixed' }));
  });
});
