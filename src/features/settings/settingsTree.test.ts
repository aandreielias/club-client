import { describe, expect, it } from 'vitest';
import { searchSettings, tabPath, visibleSettings, type SettingsEntry } from './settingsTree';

const none = { sees: () => false };
const board = { sees: (roles: readonly string[]) => roles.includes('BOARD') };
const keys = (entries: SettingsEntry[]): unknown[] => entries.map((e) => (e.children ? [e.key, keys(e.children)] : e.key));

describe('settings tree', () => {
  it('shows the club group only to admin and board, Allgemein always last', () => {
    const player = visibleSettings(none);
    expect(keys(player.tree)).toEqual([
      ['settings:personal', [['settings:view', ['appearance', 'home', 'sidebar']], ['settings:use', ['notifications', 'shortcuts']], 'security']],
      'general',
    ]);
    expect(player.tabs.map((t) => t.id)).toEqual(['appearance', 'home', 'sidebar', 'notifications', 'shortcuts', 'security', 'general']);
    // tournament guests: no start page or sidebar order
    expect(visibleSettings({ ...none, guest: true }).tabs.map((t) => t.id)).toEqual([
      'appearance',
      'notifications',
      'shortcuts',
      'security',
      'general',
    ]);
    expect(visibleSettings(board).tabs.map((t) => t.id)).toContain('resolution-rules');
    expect(tabPath('meeting-types')).toBe('Verein › Sitzungen und Beschlüsse › Sitzungsarten');
    expect(tabPath('brand-look')).toBe('Verein › Auftritt › Erscheinungsbild › Aussehen');
    expect(tabPath('general')).toBe('Allgemein');
  });

  it('shows the fee settings from WRITE on; a group left with one tab shows that tab', () => {
    const finance = (level?: 'READ' | 'WRITE') =>
      visibleSettings({ ...board, finance: level }).tree.find((e) => e.key === 'settings:club')!.children!;
    expect(keys(finance('WRITE'))).toContainEqual(['settings:finance', ['finance', ['settings:fees', ['fees-due', 'fees-payment']]]]);
    expect(keys(finance('READ'))).toContain('finance');
    expect(visibleSettings({ ...board, finance: 'READ' }).tabs.map((t) => t.id)).not.toContain('fees-due');
  });
});

describe('settings search', () => {
  it('finds sections by label, path and keywords, only those the member sees', () => {
    expect(searchSettings('domain', board).map((t) => t.id)).toEqual(['mailboxes']);
    expect(searchSettings('verein sitzungsarten', board).map((t) => t.id)).toEqual(['meeting-types']);
    expect(searchSettings('Mehrheit', board).map((t) => t.id)).toContain('resolution-rules');
    expect(searchSettings('domain', none)).toEqual([]);
    expect(searchSettings('', none).length).toBe(7);
    expect(searchSettings('fahrgemeinschaften', board).map((t) => t.id)).toEqual(['appointment-types']);
    expect(searchSettings('ferien', board).map((t) => t.id)).toEqual(['holidays']);
    expect(searchSettings('erscheinungsbild', board).map((t) => t.id)).toEqual(['brand-look', 'brand-logos', 'brand-mail']);
  });
});
