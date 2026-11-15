import type { IconName } from '../../icons';
import { groupsAbove, leafKeys, resolveTree, type NavDef, type NavNode } from '../../lib/navigation/NavTree';
import { ADMIN_BOARD, type FinanceLevel, type Role } from '../../lib/types';
import { reaches } from '../finance/model';

export type SectionId =
  | 'appearance'
  | 'home'
  | 'sidebar'
  | 'shortcuts'
  | 'security'
  | 'general'
  | 'club'
  | 'brand-look'
  | 'brand-logos'
  | 'brand-mail'
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
  | 'finance'
  | 'fees-due'
  | 'fees-payment';

export interface SettingsTab {
  id: SectionId;
  /** Unique among all settings tabs and sidebar tabs (NavTree.test). */
  label: string;
  /** Shown in the settings sidebar (also when it is collapsed). */
  icon: IconName;
  /** What the section is for: ⓘ after the page title, tooltip of the tab in the settings window. */
  hint?: string;
  /** Further words the settings search finds the tab by. */
  keywords?: string;
  /** Only shown to these, within a group others see too. */
  roles?: readonly Role[];
  /** Only shown from this Buchhaltung level on. */
  finance?: FinanceLevel;
  /** Not for tournament guests (they have no start page and almost no navigation). */
  noGuests?: boolean;
}

/** A row of the settings tree: a tab, or a group (key `settings:<id>`) with its children. */
export interface SettingsEntry {
  key: string;
  label: string;
  icon: IconName;
  tab?: SettingsTab;
  children?: SettingsEntry[];
}

/** Who sees the settings: roles, tournament guest only, Buchhaltung level. */
export interface SettingsViewer {
  sees: (roles: readonly Role[]) => boolean;
  guest?: boolean;
  finance?: FinanceLevel;
}

const TABS: { [K in SectionId]: Omit<SettingsTab, 'id'> } = {
  appearance: { label: 'Darstellung', icon: 'appearance', keywords: 'farbe theme dunkel hell schrift dichte' },
  home: {
    label: 'Startseite',
    hint: 'Abschnitte der Startseite ein- und ausschalten und an die gewünschte Stelle ziehen. Was du nicht sehen darfst, fehlt in der Liste.',
    icon: 'home',
    keywords: 'bereiche start übersicht',
    noGuests: true,
  },
  sidebar: {
    label: 'Seitenleiste',
    hint: 'Die Bereiche der Seitenleiste an die gewünschte Stelle ziehen; was in einem Bereich steht, bleibt fest. Mit der Tastatur: Eintrag auswählen, Leertaste, Pfeiltasten, Leertaste. Einstellungen und Abmelden bleiben unten.',
    icon: 'sidebar',
    keywords: 'navigation reihenfolge menü',
    noGuests: true,
  },
  notifications: { label: 'Mitteilungen', icon: 'notifications', keywords: 'benachrichtigungen push e-mail mitteilung hinweis' },
  shortcuts: { label: 'Tastenkürzel', icon: 'keyboard', keywords: 'tasten befehle kürzel' },
  security: { label: 'Sicherheit', icon: 'security', keywords: 'passwort kennwort konto' },
  club: { label: 'Vereinsdaten', icon: 'club', keywords: 'name adresse website kontakt zvr saison' },
  'brand-look': {
    label: 'Aussehen',
    hint: 'So sehen die Website und die E-Mails des Vereins für alle aus.',
    icon: 'brand',
    keywords: 'farben schrift marke design ecken app-name',
  },
  'brand-logos': { label: 'Logos', icon: 'files', keywords: 'logo favicon browsersymbol bild' },
  'brand-mail': { label: 'E-Mail-Texte', icon: 'mail', keywords: 'anrede gruß fußzeile mail vorschau' },
  templates: { label: 'Vorlagen', icon: 'document', keywords: 'einladung protokoll kassenprüfung bericht word dotx briefkopf platzhalter' },
  membership: { label: 'Mitgliedsarten', icon: 'members', keywords: 'mitgliedschaft ehrenmitglied stimmrecht minderjährige eltern alter' },
  offices: { label: 'Funktionen', icon: 'offices', keywords: 'vorstand obmann kassier schriftführer amtszeit kooptierung' },
  'meeting-types': {
    label: 'Sitzungsarten',
    hint: 'Welche Sitzungen der Verein abhält und nach welchen Regeln: wer eingeladen wird, die Einladungsfrist, wer einberuft, wann die Sitzung beschlussfähig ist und was sie beschließen darf.',
    icon: 'meetings',
    keywords: 'einladung frist beschlussfähig online ablauf',
  },
  'resolution-rules': { label: 'Beschlussregeln', icon: 'resolutions', keywords: 'mehrheit umlaufbeschluss' },
  'appointment-types': {
    label: 'Terminarten',
    hint: 'Welche Arten von Terminen es gibt, in welcher Farbe sie im Kalender stehen und ob Fahrgemeinschaften und Kabinen angeboten werden.',
    icon: 'calendar',
    keywords: 'farbe kabinen fahrgemeinschaften training spiel',
  },
  holidays: {
    label: 'Feiertage',
    hint: 'Ferien und freie Tage. Neue wöchentliche Serien lassen diese Tage aus; der Kalender zeigt sie allen. Bestehende Termine sagst du im Kalender mit „Zeitraum absagen“ ab.',
    icon: 'holidays',
    keywords: 'ferien frei urlaub schulferien serie',
  },
  finance: { label: 'Konten und Kategorien', icon: 'finance', keywords: 'kassa bank geld einnahmen ausgaben' },
  'fees-due': {
    label: 'Fälligkeit',
    hint: 'Wann Beiträge fällig sind und wie oft an offene erinnert wird.',
    icon: 'calendar',
    keywords: 'mitgliedsbeitrag erinnerung tage',
    finance: 'WRITE',
  },
  'fees-payment': {
    label: 'Zahlung',
    hint: 'Wie Mitglieder ihre Beiträge bezahlen: Text und Bankverbindung für den QR-Code.',
    icon: 'finance',
    keywords: 'mitgliedsbeitrag iban bic qr überweisung',
    finance: 'WRITE',
  },
  tasks: { label: 'Aufgaben-Erinnerung', icon: 'tasks', keywords: 'aufgaben erinnerung fällig frist vorlauf' },
  files: { label: 'Speicherplatz', icon: 'files', keywords: 'dateien upload kontingent quota gb' },
  mailboxes: { label: 'Postfächer', icon: 'mail', keywords: 'mail e-mail domain adresse limit signatur' },
  general: { label: 'Allgemein', icon: 'settings', keywords: 'sprache zeitzone app version' },
};

/** The tree of Einstellungen, by who sets things up: the member, the club (admin/board), then Allgemein. */
const SETTINGS_TREE: readonly NavDef[] = [
  {
    id: 'personal',
    label: 'Persönlich',
    icon: 'account',
    children: [
      { id: 'view', label: 'Ansicht', icon: 'appearance', children: ['appearance', 'home', 'sidebar'] },
      { id: 'use', label: 'Bedienung', icon: 'keyboard', children: ['notifications', 'shortcuts'] },
      'security',
    ],
  },
  {
    id: 'club',
    label: 'Verein',
    icon: 'club',
    children: [
      {
        id: 'presence',
        label: 'Auftritt',
        icon: 'brand',
        children: [
          'club',
          { id: 'brand', label: 'Erscheinungsbild', icon: 'brand', children: ['brand-look', 'brand-logos', 'brand-mail'] },
          'templates',
        ],
      },
      { id: 'membership', label: 'Mitgliedschaft', icon: 'members', children: ['membership', 'offices'] },
      { id: 'meetings', label: 'Sitzungen und Beschlüsse', icon: 'meetings', children: ['meeting-types', 'resolution-rules'] },
      { id: 'calendar', label: 'Kalender', icon: 'calendar', children: ['appointment-types', 'holidays'] },
      {
        id: 'finance',
        label: 'Buchhaltung',
        icon: 'finance',
        children: ['finance', { id: 'fees', label: 'Mitgliedsbeiträge', icon: 'finance', children: ['fees-due', 'fees-payment'] }],
      },
      { id: 'operations', label: 'Betrieb', icon: 'settings', children: ['tasks', 'files', 'mailboxes'] },
    ],
  },
  'general',
];

/** Groups only these see (with everything in them). */
const GROUP_ROLES: Readonly<Record<string, readonly Role[]>> = { club: ADMIN_BOARD };

const tabOf = (id: string): SettingsTab => ({ id: id as SectionId, ...TABS[id as SectionId] });

/** Every settings tab, in tree order (for tests and lookups). */
export const ALL_TABS: readonly SettingsTab[] = leafKeys(SETTINGS_TREE).map(tabOf);

/** The tree a member sees and all its tabs in display order (Allgemein last). */
export function visibleSettings(viewer: SettingsViewer): { tree: SettingsEntry[]; tabs: SettingsTab[] } {
  const shown = (t: SettingsTab) =>
    (!t.roles || viewer.sees(t.roles)) &&
    !(viewer.guest && t.noGuests) &&
    (!t.finance || reaches(viewer.finance, t.finance)) &&
    (groupsAbove(SETTINGS_TREE, t.id) ?? []).every((g) => !GROUP_ROLES[g.id] || viewer.sees(GROUP_ROLES[g.id]));
  const tree = resolveTree(SETTINGS_TREE, (id) => {
    const tab = tabOf(id);
    return shown(tab) ? tab : undefined;
  });
  const entries = (nodes: NavNode<SettingsTab>[]): SettingsEntry[] =>
    nodes.map((n) =>
      'leaf' in n
        ? { key: n.leaf.id, label: n.leaf.label, icon: n.leaf.icon, tab: n.leaf }
        : { key: `settings:${n.group.id}`, label: n.group.label, icon: n.group.icon, children: entries(n.children) },
    );
  return { tree: entries(tree), tabs: ALL_TABS.filter(shown) };
}

/** "Verein › Kalender › Terminarten", or the tab's label alone outside a group. */
export function tabPath(id: SectionId): string {
  return [...(groupsAbove(SETTINGS_TREE, id) ?? []).map((g) => g.label), TABS[id].label].join(' › ');
}

/** Tabs whose label, path or keywords contain every word of `query` (any case); all visible tabs for an empty query. */
export function searchSettings(query: string, viewer: SettingsViewer): SettingsTab[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return visibleSettings(viewer).tabs.filter((tab) => {
    const text = `${tabPath(tab.id)} ${tab.keywords ?? ''}`.toLowerCase();
    return words.every((w) => text.includes(w));
  });
}
