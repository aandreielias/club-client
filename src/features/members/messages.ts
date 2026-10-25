import { settings } from '../../settings';
import type { BoardSettings } from './MembersApi';
import type { MessageCatalog } from '../../lib/errors/ErrorMessages';

const limits = settings.members;

export const MEMBER_MESSAGES: MessageCatalog = {
  'member.email-invalid': 'Ungültige E-Mail-Adresse (vor dem @ keine Umlaute, Domains mit ß werden nicht unterstützt).',
  'member.email-taken': 'Zu dieser E-Mail-Adresse gibt es schon ein Mitglied.',
  'member.change-needs-request': 'Namen und Geburtsdatum bitte über einen Änderungsantrag ändern.',
  'member.first-name-invalid': `Vorname mit 1 bis ${limits.nameMaxLength} Zeichen angeben.`,
  'member.last-name-invalid': `Nachname mit 1 bis ${limits.nameMaxLength} Zeichen angeben.`,
  'member.cannot-deactivate-self': 'Du kannst dich nicht selbst deaktivieren.',
  'member.cannot-remove-own-admin': 'Die eigene Admin-Rolle lässt sich nicht entfernen.',
  'member.guardian-is-self': 'Ein Mitglied kann nicht sein eigener Erziehungsberechtigter sein.',
  'change-request.open-exists': 'Für diese Angabe läuft schon eine Anfrage.',
  'change-request.value-missing': 'Bitte die neue Angabe eintragen.',
  'change-request.note-too-long': `Begründung mit höchstens ${limits.changeNoteMaxLength} Zeichen.`,
  'change-request.decided': 'Über diese Anfrage wurde schon entschieden.',
  'change-request.not-found': 'Diese Anfrage gibt es nicht mehr.',
  'change-request.field-missing': 'Bitte angeben, was geändert werden soll.',
  'member.erased': 'Gelöschte Personendaten lassen sich nicht wiederherstellen.',
  'member.erase-active': 'Das Mitglied zuerst deaktivieren.',
  'member.guardian-cycle': 'Diese Person ist schon von diesem Mitglied abhängig (Kreis).',
  'member.guardian-not-linked': 'Diese Person ist nicht (mehr) zugeordnet.',
  'member.board-by-office': 'Die Vorstandsrolle kommt mit einer Funktion im Vorstand (Seite Vorstand).',
  'member.holds-office': 'Funktionsträger:innen müssen außerordentliche oder Ehrenmitglieder bleiben. Zuerst die Funktion beenden.',
  'member.member-since-in-future': 'Das Eintrittsdatum liegt in der Zukunft.',
  'office.not-eligible': 'Nur außerordentliche und Ehrenmitglieder können gewählt werden.',
  'office.taken': 'Diese Funktion ist schon besetzt. Zuerst die bisherige beenden.',
  'office.already-held': 'Diese Person hat die Funktion schon.',
  'office.combination': 'Nur die Stellvertretung darf zusätzlich Kassier:in oder Schriftführung sein.',
  'office.auditor-in-board': 'Rechnungsprüfer:innen dürfen nicht im Vorstand sein.',
  'office.term-invalid': 'Die Funktionsperiode endet nach dem Beginn und dauert höchstens drei Jahre.',
  'office.start-in-future': 'Funktionen erst ab ihrem Beginn eintragen.',
  'office.already-ended': 'Diese Funktion ist schon beendet.',
  'office.not-found': 'Diese Funktion gibt es nicht mehr.',
  'office.disabled': 'Der Verein nutzt diese Funktion nicht (Einstellungen › Funktionen).',
  'board-settings.offices-invalid': 'Jede Funktion genau einmal angeben.',
  'board-settings.label-invalid': 'Jede Funktion braucht eine Bezeichnung mit 1 bis 40 Zeichen.',
  'board-settings.holders-invalid': 'Anzahl zwischen 0 und 20, höchstens nicht unter mindestens; ungenutzte Funktionen brauchen niemanden.',
  'board-settings.term-invalid': 'Eine Funktionsperiode dauert 1 bis 10 Jahre.',
  'board-settings.chair-required': 'Den Vorsitz braucht jeder Verein.',
  'board-settings.board-invalid': 'Vorstand 1 bis 20 Personen, Kooptieren 0 bis 52 Wochen, Fristen 1 bis 365 Tage.',
};

/** Gaps on the board page (server: BoardRules.warnings), worded with the club's office settings. */
export function boardWarning(code: string, settings: BoardSettings | null): string {
  if (code === 'board.too-small') return `Der Vorstand braucht mindestens ${settings?.minBoardSize ?? 3} Personen.`;
  if (code === 'board.even') return 'Der Vorstand braucht eine ungerade Anzahl Personen.';
  const kind = code === 'board.auditors-missing' ? 'AUDITOR' : code.replace(/^board\.|-missing$/g, '').replace('-', '_').toUpperCase();
  const office = settings?.offices.find((o) => o.office === kind);
  if (!office) return code;
  return office.minHolders > 1 ? `${office.label}: es braucht ${office.minHolders} Personen.` : `${office.label} ist nicht besetzt.`;
}
