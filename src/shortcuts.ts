/**
 * Central catalog of every keyboard command: label, group, context and default keys.
 * Users can change the keys in the settings window; their changes are stored per browser on top of
 * these defaults. Key syntax: `Mod` = Cmd on macOS, Ctrl elsewhere; combos join with `+`
 * (`Mod+K`, `Shift+R`); a space separates the steps of a sequence (`g k` = G, then K).
 *
 * Context decides where keys may repeat: a `global` key must be unique; keys of other contexts
 * only clash within the same context. Every action on a record (src/lib/actions) is a `window` command:
 * verbs shared by many kinds are one `record.*` command each, the window shown decides what it does.
 */

export type ShortcutContext = 'global' | 'window' | 'list' | 'page' | 'calendar' | 'notifications';

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
  'nav.events': { label: 'Zu den Terminen', group: 'Navigation', context: 'global', keys: 'g x', path: '/events' },
  'nav.meetings': { label: 'Zu den Sitzungen', group: 'Navigation', context: 'global', keys: 'g s', path: '/meetings' },
  'nav.resolutions': { label: 'Zu den Beschlüssen', group: 'Navigation', context: 'global', keys: 'g u', path: '/resolutions' },
  'nav.board': { label: 'Zum Vorstand', group: 'Navigation', context: 'global', keys: 'g v', path: '/board' },
  'nav.org-chart': { label: 'Zum Organigramm', group: 'Navigation', context: 'global', keys: 'g c', path: '/members?view=org' },
  'nav.tasks': { label: 'Zu den Aufgaben', group: 'Navigation', context: 'global', keys: 'g a', path: '/tasks' },
  'nav.files': { label: 'Zu den Dateien', group: 'Navigation', context: 'global', keys: 'g d', path: '/files' },
  'nav.inventory': { label: 'Zum Inventar', group: 'Navigation', context: 'global', keys: 'g i', path: '/inventory' },
  'nav.finance': { label: 'Zur Buchhaltung', group: 'Navigation', context: 'global', keys: 'g f', path: '/finance' },
  'nav.locations': { label: 'Zu den Orten', group: 'Navigation', context: 'global', keys: 'g o', path: '/locations' },
  'nav.tournaments': { label: 'Zu den Turnieren', group: 'Navigation', context: 'global', keys: 'g r', path: '/tournaments' },
  'nav.teams': { label: 'Zu den Teams', group: 'Navigation', context: 'global', keys: 'g t', path: '/teams' },
  'nav.notifications': { label: 'Zu den Benachrichtigungen', group: 'Navigation', context: 'global', keys: 'g b', path: '/notifications' },
  'nav.mail': { label: 'Zu den E-Mails', group: 'Navigation', context: 'global', keys: 'g n', path: '/mail' },
  'nav.members': { label: 'Zu den Mitgliedern', group: 'Navigation', context: 'global', keys: 'g m', path: '/members' },
  'nav.activity': { label: 'Zu den Protokollen', group: 'Navigation', context: 'global', keys: 'g l', path: '/activity' },
  'nav.account': { label: 'Zu meinem Konto', group: 'Navigation', context: 'global', keys: 'g p', path: '/account' },
  'nav.settings': { label: 'Zu den Einstellungen', group: 'Navigation', context: 'global', keys: 'g e', path: '/settings' },
  'nav.absences': { label: 'Zu den Abwesenheiten', group: 'Navigation', context: 'global', keys: 'g w', path: '/calendar/absences' },
  'nav.search': { label: 'Zur Suchseite', group: 'Navigation', context: 'global', keys: 'g q', path: '/search' },
  'nav.back': { label: 'Zurück', group: 'Navigation', context: 'global', keys: 'Alt+ArrowLeft' },

  // ---- Fenster ----
  'view.back': {
    label: 'Eine Ansicht zurück (Bearbeiten beenden, vorheriger Eintrag, Fenster schließen)',
    group: 'Fenster',
    context: 'global',
    keys: 'Escape',
  },
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

  // ---- Eintrag (das Fenster, auch Kontextmenü und Befehlspalette) ----
  'record.menu': { label: 'Aktionen des Eintrags', group: 'Eintrag', context: 'window', keys: 'Shift+F10' },
  'record.edit': { label: 'Bearbeiten', group: 'Eintrag', context: 'window', keys: 'e' },
  'record.delete': { label: 'Löschen', group: 'Eintrag', context: 'window', keys: 'Shift+Delete' },
  'record.archive': { label: 'Archivieren', group: 'Eintrag', context: 'window', keys: '' },
  'record.restore': { label: 'Wiederherstellen', group: 'Eintrag', context: 'window', keys: '' },
  'record.download': { label: 'Herunterladen', group: 'Eintrag', context: 'window', keys: 'd' },
  'record.copyLink': { label: 'Link kopieren', group: 'Eintrag', context: 'window', keys: 'Shift+C' },

  'task.done': { label: 'Aufgabe erledigt oder wieder offen', group: 'Aufgabe', context: 'window', keys: 'x' },
  'appointment.yes': { label: 'Zusagen', group: 'Termin', context: 'window', keys: '1' },
  'appointment.maybe': { label: 'Vielleicht', group: 'Termin', context: 'window', keys: '2' },
  'appointment.no': { label: 'Absagen (Antwort)', group: 'Termin', context: 'window', keys: '3' },
  'appointment.cancel': { label: 'Termin absagen', group: 'Termin', context: 'window', keys: '' },
  'appointment.extend': { label: 'Serie verlängern', group: 'Termin', context: 'window', keys: '' },
  'member.invite': { label: 'Login einladen', group: 'Mitglied', context: 'window', keys: '' },
  'member.deactivate': { label: 'Mitglied deaktivieren', group: 'Mitglied', context: 'window', keys: '' },
  'member.reactivate': { label: 'Mitglied reaktivieren', group: 'Mitglied', context: 'window', keys: '' },
  'member.erase': { label: 'Personendaten löschen (DSGVO)', group: 'Mitglied', context: 'window', keys: '' },
  'team.addMember': { label: 'Mitglied hinzufügen', group: 'Team', context: 'window', keys: '' },
  'team.requestPlayer': { label: 'Spieler:in anfragen', group: 'Team', context: 'window', keys: '' },
  'team.newSeason': { label: 'Neue Saison', group: 'Team', context: 'window', keys: '' },
  'tournament.draw': { label: 'Auslosen', group: 'Turnier', context: 'window', keys: '' },
  'tournament.knockout': { label: 'KO-Runde starten', group: 'Turnier', context: 'window', keys: '' },
  'item.stock': { label: 'Bestand verteilen', group: 'Inventar', context: 'window', keys: '' },
  'file.newVersion': { label: 'Neue Version hochladen', group: 'Datei', context: 'window', keys: '' },
  'file.tag': { label: 'Personen markieren', group: 'Datei', context: 'window', keys: '' },
  'mail.reply': { label: 'Antworten', group: 'E-Mail', context: 'window', keys: 'r' },
  'mail.replyAll': { label: 'Allen antworten', group: 'E-Mail', context: 'window', keys: 'Shift+R' },
  'mail.forward': { label: 'Weiterleiten', group: 'E-Mail', context: 'window', keys: 'f' },
  'mail.unread': { label: 'Als ungelesen markieren', group: 'E-Mail', context: 'window', keys: 'u' },
  'meeting.invite': { label: 'Zur Sitzung einladen', group: 'Sitzung', context: 'window', keys: 'i' },
  'meeting.open': { label: 'Sitzung eröffnen', group: 'Sitzung', context: 'window', keys: '' },
  'meeting.close': { label: 'Sitzung beenden', group: 'Sitzung', context: 'window', keys: '' },
  'meeting.cancel': { label: 'Sitzung absagen', group: 'Sitzung', context: 'window', keys: '' },
  'resolution.close': { label: 'Abstimmung schließen', group: 'Beschluss', context: 'window', keys: '' },
  'booking.reverse': { label: 'Buchung stornieren', group: 'Buchhaltung', context: 'window', keys: '' },
  'invoice.pay': { label: 'Rechnung als bezahlt buchen', group: 'Buchhaltung', context: 'window', keys: '' },
  'fee.pay': { label: 'Beitragszahlung buchen', group: 'Buchhaltung', context: 'window', keys: '' },
  'fee.remind': { label: 'An Beitrag erinnern', group: 'Buchhaltung', context: 'window', keys: '' },
  'notifications.readAll': { label: 'Alle als gelesen markieren', group: 'Benachrichtigungen', context: 'notifications', keys: 'Shift+R' },
} as const satisfies Record<string, ShortcutDefinition>;

export type CommandId = keyof typeof SHORTCUTS;
