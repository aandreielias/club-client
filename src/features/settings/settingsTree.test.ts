import { describe, expect, it } from 'vitest';
import { tabPath, visibleSettings } from './settingsTree';

describe('settings tree', () => {
  it('shows the club group only to admin and board, Allgemein always last', () => {
    const player = visibleSettings(() => false);
    expect(player.groups.map((g) => g.id)).toEqual(['personal']);
    expect(player.tabs.map((t) => t.id)).toEqual(['appearance', 'home', 'sidebar', 'shortcuts', 'security', 'general']);
    const board = visibleSettings(() => true);
    expect(board.tabs.at(-1)?.id).toBe('general');
    expect(board.tabs.map((t) => t.id)).toContain('resolution-rules');
    expect(tabPath('meeting-types')).toBe('Verein › Sitzungsarten');
    expect(tabPath('general')).toBe('Allgemein');
    expect(visibleSettings((roles) => roles.includes('BOARD')).tabs.map((t) => t.id)).not.toContain('audit');
    expect(visibleSettings((roles) => roles.includes('ADMIN')).tabs.map((t) => t.id)).toContain('audit');
  });
});
