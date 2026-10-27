import type { IconName } from '../../icons';
import { ADMIN_BOARD, type Role } from '../../lib/types';

export type SectionId =
  | 'appearance'
  | 'home'
  | 'sidebar'
  | 'shortcuts'
  | 'security'
  | 'general'
  | 'club'
  | 'meeting-types'
  | 'membership'
  | 'offices'
  | 'resolution-rules'
  | 'appointment-types'
  | 'audit';

export interface SettingsTab {
  id: SectionId;
  label: string;
  /** Only shown to these, within a group others see too. */
  roles?: readonly Role[];
}

/** A group of the tree (like a sidebar group): subgroups of tabs; `roles`: only shown to these (club-wide settings). */
export interface SettingsGroup {
  id: string;
  label: string;
  icon: IconName;
  roles?: readonly Role[];
  subgroups: readonly { label: string; tabs: readonly SettingsTab[] }[];
}

export const SETTINGS_TREE: readonly SettingsGroup[] = [
  {
    id: 'personal',
    label: 'Persönlich',
    icon: 'account',
    subgroups: [
      {
        label: 'Ansicht',
        tabs: [
          { id: 'appearance', label: 'Darstellung' },
          { id: 'home', label: 'Startseite' },
          { id: 'sidebar', label: 'Seitenleiste' },
        ],
      },
      { label: 'Bedienung', tabs: [{ id: 'shortcuts', label: 'Tastenkürzel' }] },
      { label: 'Konto', tabs: [{ id: 'security', label: 'Sicherheit' }] },
    ],
  },
  {
    id: 'club',
    label: 'Verein',
    icon: 'club',
    roles: ADMIN_BOARD,
    subgroups: [
      { label: 'Stammdaten', tabs: [{ id: 'club', label: 'Verein' }] },
      {
        label: 'Mitglieder',
        tabs: [
          { id: 'membership', label: 'Mitgliedschaft' },
          { id: 'offices', label: 'Funktionen' },
        ],
      },
      {
        label: 'Sitzungen',
        tabs: [
          { id: 'meeting-types', label: 'Sitzungsarten' },
          { id: 'resolution-rules', label: 'Beschlüsse' },
        ],
      },
      { label: 'Kalender', tabs: [{ id: 'appointment-types', label: 'Termine' }] },
      { label: 'Sicherheit', tabs: [{ id: 'audit', label: 'Protokoll', roles: ['ADMIN'] }] },
    ],
  },
];

/** Below every group. */
export const LAST_TAB: SettingsTab = { id: 'general', label: 'Allgemein' };

/** The groups a member sees, and all their tabs in display order (Allgemein last). */
export function visibleSettings(sees: (roles: readonly Role[]) => boolean): { groups: SettingsGroup[]; tabs: SettingsTab[] } {
  const groups = SETTINGS_TREE.filter((g) => !g.roles || sees(g.roles)).map((g) => ({
    ...g,
    subgroups: g.subgroups.map((s) => ({ ...s, tabs: s.tabs.filter((t) => !t.roles || sees(t.roles)) })).filter((s) => s.tabs.length),
  }));
  return { groups, tabs: [...groups.flatMap((g) => g.subgroups.flatMap((s) => s.tabs)), LAST_TAB] };
}

/** "Verein › Sitzungsarten", or the tab's label alone outside a group. */
export function tabPath(id: SectionId): string {
  const group = SETTINGS_TREE.find((g) => g.subgroups.some((s) => s.tabs.some((t) => t.id === id)));
  const tab = group?.subgroups.flatMap((s) => s.tabs).find((t) => t.id === id) ?? LAST_TAB;
  return group ? `${group.label} › ${tab.label}` : tab.label;
}
