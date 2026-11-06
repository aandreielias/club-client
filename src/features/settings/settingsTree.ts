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
  | 'brand'
  | 'templates'
  | 'meeting-types'
  | 'membership'
  | 'offices'
  | 'resolution-rules'
  | 'appointment-types'
  | 'holidays'
  | 'notifications'
  | 'files'
  | 'tasks'
  | 'mailboxes'
  | 'audit';

export interface SettingsTab {
  id: SectionId;
  label: string;
  /** Shown in the settings sidebar (also when it is collapsed). */
  icon: IconName;
  /** Further words the settings search finds the tab by. */
  keywords?: string;
  /** Only shown to these, within a group others see too. */
  roles?: readonly Role[];
  /** Not for tournament guests (they have no start page and almost no navigation). */
  noGuests?: boolean;
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
          { id: 'appearance', label: 'Darstellung', icon: 'appearance', keywords: 'farbe theme dunkel hell schrift dichte' },
          { id: 'home', label: 'Startseite', icon: 'home', keywords: 'bereiche start übersicht', noGuests: true },
          { id: 'sidebar', label: 'Seitenleiste', icon: 'sidebar', keywords: 'navigation reihenfolge menü', noGuests: true },
        ],
      },
      {
        label: 'Bedienung',
        tabs: [
          { id: 'notifications', label: 'Benachrichtigungen', icon: 'notifications', keywords: 'push e-mail mitteilung hinweis' },
          { id: 'shortcuts', label: 'Tastenkürzel', icon: 'keyboard', keywords: 'tasten befehle kürzel' },
        ],
      },
      { label: 'Konto', tabs: [{ id: 'security', label: 'Sicherheit', icon: 'security', keywords: 'passwort kennwort' }] },
    ],
  },
  {
    id: 'club',
    label: 'Verein',
    icon: 'club',
    roles: ADMIN_BOARD,
    subgroups: [
      {
        label: 'Stammdaten',
        tabs: [
          { id: 'club', label: 'Verein', icon: 'club', keywords: 'name adresse website kontakt zvr saison' },
          { id: 'brand', label: 'Erscheinungsbild', icon: 'brand', keywords: 'logo farben schrift marke favicon design aussehen ecken' },
          { id: 'templates', label: 'Vorlagen', icon: 'document', keywords: 'einladung protokoll word dotx briefkopf platzhalter' },
        ],
      },
      {
        label: 'Mitglieder',
        tabs: [
          {
            id: 'membership',
            label: 'Mitgliedschaft',
            icon: 'members',
            keywords: 'mitgliedsarten ehrenmitglied stimmrecht minderjährige eltern alter',
          },
          { id: 'offices', label: 'Funktionen', icon: 'offices', keywords: 'vorstand obmann kassier schriftführer amtszeit kooptierung' },
        ],
      },
      {
        label: 'Sitzungen',
        tabs: [
          { id: 'meeting-types', label: 'Sitzungsarten', icon: 'meetings', keywords: 'sitzung einladung frist beschlussfähig online ablauf' },
          { id: 'resolution-rules', label: 'Beschlüsse', icon: 'resolutions', keywords: 'mehrheit umlaufbeschluss' },
        ],
      },
      {
        label: 'Kalender',
        tabs: [
          { id: 'appointment-types', label: 'Termine', icon: 'calendar', keywords: 'terminarten farbe kabinen fahrgemeinschaften training spiel' },
          { id: 'holidays', label: 'Feiertage', icon: 'holidays', keywords: 'ferien frei urlaub schulferien serie' },
        ],
      },
      {
        label: 'Aufgaben und Dateien',
        tabs: [
          { id: 'tasks', label: 'Aufgaben', icon: 'tasks', keywords: 'erinnerung fällig frist vorlauf' },
          { id: 'files', label: 'Dateien', icon: 'files', keywords: 'speicherplatz upload kontingent quota gb' },
        ],
      },
      { label: 'E-Mail', tabs: [{ id: 'mailboxes', label: 'Postfächer', icon: 'mail', keywords: 'mail e-mail domain adresse limit signatur' }] },
      {
        label: 'Sicherheit',
        tabs: [{ id: 'audit', label: 'Protokoll', icon: 'activity', keywords: 'audit zugriffe änderungen export', roles: ['ADMIN'] }],
      },
    ],
  },
];

/** Below every group. */
export const LAST_TAB: SettingsTab = { id: 'general', label: 'Allgemein', icon: 'settings', keywords: 'sprache zeitzone app version' };

/** The groups a member sees, and all their tabs in display order (Allgemein last); `guest`: a tournament guest only. */
export function visibleSettings(sees: (roles: readonly Role[]) => boolean, guest = false): { groups: SettingsGroup[]; tabs: SettingsTab[] } {
  const shown = (t: SettingsTab) => (!t.roles || sees(t.roles)) && !(guest && t.noGuests);
  const groups = SETTINGS_TREE.filter((g) => !g.roles || sees(g.roles)).map((g) => ({
    ...g,
    subgroups: g.subgroups.map((s) => ({ ...s, tabs: s.tabs.filter(shown) })).filter((s) => s.tabs.length),
  }));
  return { groups, tabs: [...groups.flatMap((g) => g.subgroups.flatMap((s) => s.tabs)), LAST_TAB] };
}

/** "Verein › Sitzungsarten", or the tab's label alone outside a group. */
export function tabPath(id: SectionId): string {
  const group = SETTINGS_TREE.find((g) => g.subgroups.some((s) => s.tabs.some((t) => t.id === id)));
  const tab = group?.subgroups.flatMap((s) => s.tabs).find((t) => t.id === id) ?? LAST_TAB;
  return group ? `${group.label} › ${tab.label}` : tab.label;
}

/** Tabs whose label, path or keywords contain every word of `query` (any case); all visible tabs for an empty query. */
export function searchSettings(query: string, sees: (roles: readonly Role[]) => boolean, guest = false): SettingsTab[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return visibleSettings(sees, guest).tabs.filter((tab) => {
    const text = `${tabPath(tab.id)} ${tab.keywords ?? ''}`.toLowerCase();
    return words.every((w) => text.includes(w));
  });
}
