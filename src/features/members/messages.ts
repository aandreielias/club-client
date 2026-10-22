import { settings } from '../../settings';
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
  'office.not-eligible': 'Nur außerordentliche und Ehrenmitglieder können gewählt werden (Statuten § 8 Abs. 1).',
  'office.taken': 'Diese Funktion ist schon besetzt. Zuerst die bisherige beenden.',
  'office.already-held': 'Diese Person hat die Funktion schon.',
  'office.combination': 'Nur die Stellvertretung darf zusätzlich Kassier:in oder Schriftführung sein (§ 9 Abs. 4).',
  'office.auditor-in-board': 'Rechnungsprüfer:innen dürfen nicht im Vorstand sein (§ 11).',
  'office.term-invalid': 'Die Funktionsperiode endet nach dem Beginn und dauert höchstens drei Jahre.',
  'office.start-in-future': 'Funktionen erst ab ihrem Beginn eintragen.',
  'office.already-ended': 'Diese Funktion ist schon beendet.',
  'office.not-found': 'Diese Funktion gibt es nicht mehr.',
};

/** Statute gaps on the board page (server: BoardRules.warnings). */
export const BOARD_WARNINGS: Readonly<Record<string, string>> = {
  'board.too-small': 'Der Vorstand braucht mindestens drei Personen (§ 9 Abs. 1).',
  'board.even': 'Der Vorstand braucht eine ungerade Anzahl Personen (§ 9 Abs. 1).',
  'board.chair-missing': 'Der Vorsitz ist nicht besetzt.',
  'board.treasurer-missing': 'Die Kassenführung ist nicht besetzt.',
  'board.secretary-missing': 'Die Schriftführung ist nicht besetzt.',
  'board.auditors-missing': 'Es braucht zwei Rechnungsprüfer:innen (§ 11).',
};
