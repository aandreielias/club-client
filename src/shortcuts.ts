/**
 * Central catalog of every keyboard command: label, group, context and default keys.
 * Users can change the keys in the settings window; their changes are stored per browser on top of
 * these defaults. Key syntax: `Mod` = Cmd on macOS, Ctrl elsewhere; combos join with `+`
 * (`Mod+K`, `Shift+R`); a space separates the steps of a sequence (`g k` = G, then K).
 *
 * Context decides where keys may repeat: a `global` key must be unique; keys of other contexts
 * only clash within the same context (e.g. `E` edits in the task window and in the member window).
 */

export type ShortcutContext = 'global' | 'window' | 'list' | 'page' | 'calendar' | 'task' | 'appointment' | 'member' | 'meeting' | 'notifications';

export interface ShortcutDefinition {
  label: string;
  group: string;
  context: ShortcutContext;
  /** Default keys; empty = no default (reachable through the command palette). */
  keys: string;
  /** Navigation commands: the route they open. */
  path?: string;
}

export const SHORTCUTS = {
  // ---- Allgemein ----
  'search.focus': { label: 'Suchen', group: 'Allgemein', context: 'global', keys: 'Mod+Shift+F' },
  'palette.open': { label: 'Befehlspalette öffnen', group: 'Allgemein', context: 'global', keys: 'Mod+K' },
  'settings.open': { label: 'Einstellungen öffnen', group: 'Allgemein', context: 'global', keys: 'Mod+,' },
  'help.shortcuts': { label: 'Tastenkürzel anzeigen', group: 'Allgemein', context: 'global', keys: '?' },
  'theme.toggle': { label: 'Hell und dunkel wechseln', group: 'Allgemein', context: 'global', keys: 'Shift+L' },
  'split.toggle': { label: 'Geteilte Ansicht ein- oder ausschalten', group: 'Allgemein', context: 'global', keys: 'Mod+\\' },
  'split.swap': { label: 'Seiten der geteilten Ansicht tauschen', group: 'Allgemein', context: 'global', keys: 'Mod+Shift+\\' },
  'sidebar.toggle': { label: 'Seitenleiste ein- oder ausklappen', group: 'Allgemein', context: 'global', keys: '[' },
  'auth.logout': { label: 'Abmelden', group: 'Allgemein', context: 'global', keys: '' },

  // ---- Navigation ----
  'nav.home': { label: 'Zu Start', group: 'Navigation', context: 'global', keys: 'g h', path: '/' },
  'nav.calendar': { label: 'Zum Kalender', group: 'Navigation', context: 'global', keys: 'g k', path: '/calendar' },
  'nav.events': { label: 'Zu den Events', group: 'Navigation', context: 'global', keys: 'g x', path: '/events' },
  'nav.meetings': { label: 'Zu den Sitzungen', group: 'Navigation', context: 'global', keys: 'g s', path: '/meetings' },
  'nav.deadlines': { label: 'Zu den Fristen', group: 'Navigation', context: 'global', keys: 'g f', path: '/deadlines' },
  'nav.board': { label: 'Zum Vorstand', group: 'Navigation', context: 'global', keys: 'g v', path: '/board' },
  'nav.tasks': { label: 'Zu den Aufgaben', group: 'Navigation', context: 'global', keys: 'g a', path: '/tasks' },
  'nav.files': { label: 'Zu den Dateien', group: 'Navigation', context: 'global', keys: 'g d', path: '/files' },
  'nav.inventory': { label: 'Zum Inventar', group: 'Navigation', context: 'global', keys: 'g i', path: '/inventory' },
  'nav.locations': { label: 'Zu den Orten', group: 'Navigation', context: 'global', keys: 'g o', path: '/locations' },
  'nav.tournaments': { label: 'Zu den Turnieren', group: 'Navigation', context: 'global', keys: 'g r', path: '/tournaments' },
  'nav.teams': { label: 'Zu den Teams', group: 'Navigation', context: 'global', keys: 'g t', path: '/teams' },
  'nav.notifications': { label: 'Zu den Benachrichtigungen', group: 'Navigation', context: 'global', keys: 'g b', path: '/notifications' },
  'nav.members': { label: 'Zu den Mitgliedern', group: 'Navigation', context: 'global', keys: 'g m', path: '/members' },
  'nav.activity': { label: 'Zu den Logs', group: 'Navigation', context: 'global', keys: 'g l', path: '/activity' },
  'nav.account': { label: 'Zu meinem Konto', group: 'Navigation', context: 'global', keys: 'g p', path: '/account' },
  'nav.settings': { label: 'Zu den Einstellungen', group: 'Navigation', context: 'global', keys: 'g e', path: '/settings' },
  'nav.back': { label: 'Zurück', group: 'Navigation', context: 'global', keys: 'Alt+ArrowLeft' },

  // ---- Fenster ----
  'view.back': { label: 'Eine Ansicht zurück (Bearbeiten beenden, vorheriger Eintrag, Fenster schließen)', group: 'Fenster', context: 'global', keys: 'Escape' },
  'window.close': { label: 'Fenster schließen', group: 'Fenster', context: 'window', keys: 'Shift+Escape' },
  'window.center': { label: 'Fenster in die Mitte', group: 'Fenster', context: 'window', keys: 'w m' },
  'window.side': { label: 'Fenster an die Seite', group: 'Fenster', context: 'window', keys: 'w s' },
  'window.bottom': { label: 'Fenster nach unten', group: 'Fenster', context: 'window', keys: 'w u' },
  'window.page': { label: 'Fenster als Seite öffnen', group: 'Fenster', context: 'window', keys: 'w o' },

  // ---- Seite und Listen ----
  'page.new': { label: 'Neu anlegen', group: 'Seite', context: 'page', keys: 'n' },
  'form.submit': { label: 'Formular speichern', group: 'Seite', context: 'global', keys: 'Mod+Enter' },
  'list.search': { label: 'In der Liste suchen', group: 'Listen', context: 'list', keys: '/' },
  'list.next': { label: 'Nächste Zeile', group: 'Listen', context: 'list', keys: 'j' },
  'list.previous': { label: 'Vorherige Zeile', group: 'Listen', context: 'list', keys: 'k' },
  'list.open': { label: 'Zeile öffnen', group: 'Listen', context: 'list', keys: 'Enter' },
  'list.menu': { label: 'Kontextmenü der Zeile', group: 'Listen', context: 'list', keys: 'Shift+F10' },
  'list.reset': { label: 'Filter zurücksetzen', group: 'Listen', context: 'list', keys: 'Shift+X' },

  // ---- Kalender ----
  'calendar.previous': { label: 'Vorheriger Zeitraum', group: 'Kalender', context: 'calendar', keys: 'ArrowLeft' },
  'calendar.next': { label: 'Nächster Zeitraum', group: 'Kalender', context: 'calendar', keys: 'ArrowRight' },
  'calendar.today': { label: 'Heute', group: 'Kalender', context: 'calendar', keys: 't' },
  'calendar.month': { label: 'Monatsansicht', group: 'Kalender', context: 'calendar', keys: 'v m' },
  'calendar.week': { label: 'Wochenansicht', group: 'Kalender', context: 'calendar', keys: 'v w' },

  // ---- Details im Fenster ----
  'task.edit': { label: 'Aufgabe bearbeiten', group: 'Aufgabe', context: 'task', keys: 'e' },
  'task.done': { label: 'Aufgabe erledigt oder wieder offen', group: 'Aufgabe', context: 'task', keys: 'x' },
  'appointment.edit': { label: 'Termin bearbeiten', group: 'Termin', context: 'appointment', keys: 'e' },
  'appointment.yes': { label: 'Zusagen', group: 'Termin', context: 'appointment', keys: '1' },
  'appointment.maybe': { label: 'Vielleicht', group: 'Termin', context: 'appointment', keys: '2' },
  'appointment.no': { label: 'Absagen (Antwort)', group: 'Termin', context: 'appointment', keys: '3' },
  'member.edit': { label: 'Profil bearbeiten', group: 'Mitglied', context: 'member', keys: 'e' },
  'meeting.invite': { label: 'Zur Sitzung einladen', group: 'Sitzung', context: 'meeting', keys: 'i' },
  'notifications.readAll': { label: 'Alle als gelesen markieren', group: 'Benachrichtigungen', context: 'notifications', keys: 'Shift+R' },
} as const satisfies Record<string, ShortcutDefinition>;

export type CommandId = keyof typeof SHORTCUTS;
