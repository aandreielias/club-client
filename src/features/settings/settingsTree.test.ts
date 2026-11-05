import { describe, expect, it } from 'vitest';
import { searchSettings, tabPath, visibleSettings } from './settingsTree';

describe('settings tree', () => {
  it('shows the club group only to admin and board, Allgemein always last', () => {
    const player = visibleSettings(() => false);
    expect(player.groups.map((g) => g.id)).toEqual(['personal']);
    expect(player.tabs.map((t) => t.id)).toEqual(['appearance', 'home', 'sidebar', 'notifications', 'shortcuts', 'security', 'general']);
    const board = visibleSettings(() => true);
    expect(board.tabs.at(-1)?.id).toBe('general');
    expect(board.tabs.map((t) => t.id)).toContain('resolution-rules');
    expect(tabPath('meeting-types')).toBe('Verein › Sitzungsarten');
    expect(tabPath('general')).toBe('Allgemein');
    expect(visibleSettings((roles) => roles.includes('BOARD')).tabs.map((t) => t.id)).not.toContain('audit');
    expect(visibleSettings((roles) => roles.includes('ADMIN')).tabs.map((t) => t.id)).toContain('audit');
  });
});

describe('settings search', () => {
  it('finds sections by label, path and keywords, only those the member sees', () => {
    const board = (roles: readonly string[]) => roles.includes('BOARD');
    expect(searchSettings('domain', board).map((t) => t.id)).toEqual(['mailboxes']);
    expect(searchSettings('verein sitzung', board).map((t) => t.id)).toEqual(['meeting-types']);
    expect(searchSettings('Mehrheit', board).map((t) => t.id)).toContain('resolution-rules');
    expect(searchSettings('domain', () => false)).toEqual([]);
    expect(searchSettings('', () => false).length).toBe(7);
    expect(searchSettings('fahrgemeinschaften', board).map((t) => t.id)).toEqual(['appointment-types']);
    expect(searchSettings('ferien', board).map((t) => t.id)).toEqual(['holidays']);
  });
});
