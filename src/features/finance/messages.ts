import { settings } from '../../settings';
import type { MessageCatalog } from '../../lib/errors/ErrorMessages';

const limits = settings.finance;

export const FINANCE_MESSAGES: MessageCatalog = {
  'finance.forbidden': 'Für die Buchhaltung fehlt dir die Berechtigung.',
  'finance.not-found': 'Nicht gefunden: vielleicht wurde es gelöscht.',
  'finance.booking-invalid': `Datum, Konto und einen Text mit höchstens ${limits.textMaxLength} Zeichen angeben.`,
  'finance.amount-invalid': 'Einen Betrag über 0 angeben.',
  'finance.direction-mismatch': 'Der Betrag passt nicht zur Kategorie (Einnahme oder Ausgabe).',
  'finance.account-unknown': 'Dieses Konto gibt es nicht oder es ist archiviert.',
  'finance.category-unknown': 'Diese Kategorie gibt es nicht oder sie ist archiviert.',
  'finance.booking-fixed': 'Umbuchungen und stornierte Buchungen lassen sich nicht mehr ändern.',
  'finance.already-reversed': 'Diese Buchung ist schon storniert.',
  'finance.too-many-receipts': `Höchstens ${limits.maxReceipts} Belege je Buchung.`,
  'finance.too-many-refs': `Höchstens ${limits.maxRefs} Verknüpfungen je Buchung.`,
  'finance.ref-unknown': 'Ein verknüpfter Eintrag ist nicht (mehr) sichtbar.',
  'finance.period-checked': 'Dieser Zeitraum ist schon geprüft; korrigieren nur mehr per Storno.',
  'finance.audit-date-invalid': 'Das Prüfdatum muss vor heute und nach der letzten Prüfung liegen.',
  'finance.audit-invalid': `Das Ergebnis darf höchstens ${limits.noteMaxLength} Zeichen haben.`,
  'finance.template-invalid': 'Die Vorlage für den Prüfbericht ist keine gültige Word-Vorlage (.dotx).',
  'finance.budget-invalid': 'Je Kategorie einen Betrag ab 0 planen.',
  'finance.invoice-invalid': `Von/an (bis 120 Zeichen) und einen Text (bis ${limits.textMaxLength} Zeichen) angeben.`,
  'finance.invoice-paid': 'Diese Rechnung ist schon bezahlt und lässt sich nicht mehr ändern.',
  'finance.transfer-invalid': 'Für eine Umbuchung zwei verschiedene Konten angeben.',
  'finance.bank-invalid': 'Kontoinhaber und IBAN gemeinsam angeben; die IBAN oder BIC stimmt nicht.',
  'finance.fee-invalid': 'Beträge ab 0 und Tage von 0 bis 365 angeben, jede Mitgliedsart einmal; ein Beitrag nicht unter dem schon Bezahlten.',
  'finance.charge-has-payments': 'Der Beitrag hat Zahlungen; storniere sie zuerst oder erlasse den Rest.',
  'finance.payment-too-high': 'Die Zahlung ist höher als der offene Betrag.',
  'finance-account.invalid': `Bezeichnung mit 1 bis ${limits.labelMaxLength} Zeichen angeben.`,
  'finance-account.not-found': 'Dieses Konto gibt es nicht mehr.',
  'finance-account.in-use': 'Das Konto hat Buchungen; archiviere es stattdessen.',
  'finance-category.invalid': `Bezeichnung mit 1 bis ${limits.labelMaxLength} Zeichen und Einnahme oder Ausgabe angeben.`,
  'finance-category.not-found': 'Diese Kategorie gibt es nicht mehr.',
  'finance-category.in-use': 'Die Kategorie hat Buchungen oder Rechnungen: archivieren statt löschen, Einnahme/Ausgabe bleibt.',
};
