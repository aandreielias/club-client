// Mirror of the club-server finance DTOs (FinanceApi).
import type { LinkedRef, RefKind } from '../../lib/records/refs';
import type { FinanceLevel } from '../../lib/types';

export type Direction = 'IN' | 'OUT';

export interface Account {
  key: string;
  label: string;
  sort: number;
  archived: boolean;
  inUse: boolean;
  /** All bookings so far. */
  balanceCents: number;
}

export type AccountInput = Pick<Account, 'label' | 'sort' | 'archived'>;

export interface Category {
  key: string;
  label: string;
  direction: Direction;
  sort: number;
  archived: boolean;
  inUse: boolean;
}

export type CategoryInput = Pick<Category, 'label' | 'direction' | 'sort' | 'archived'>;

export interface Receipt {
  fileId: string;
  name: string;
}

export interface Booking {
  id: string;
  /** YYYY-MM-DD */
  bookedOn: string;
  account: string;
  /** null for transfers */
  category: string | null;
  /** Positive money in, negative money out. */
  amountCents: number;
  text: string;
  note: string | null;
  transferId: string | null;
  /** The other leg's account of a transfer. */
  transferAccount: string | null;
  reversesId: string | null;
  reversedBy: string | null;
  refs: LinkedRef[];
  receipts: Receipt[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  /** On or before the last Kassenprüfung: only a Storno corrects it (server: finance.period-checked). */
  locked: boolean;
}

export interface BookingList {
  items: Booking[];
  truncated: boolean;
}

export interface BookingInput {
  bookedOn: string;
  account: string;
  category: string;
  amountCents: number;
  text: string;
  note: string | null;
  refs: { kind: RefKind; id: string }[];
}

export interface TransferInput {
  bookedOn: string;
  from: string;
  to: string;
  /** positive */
  amountCents: number;
  text: string;
  note: string | null;
}

export interface Audit {
  id: string;
  /** YYYY-MM-DD: bookings up to this day are checked. */
  checkedUntil: string;
  title: string;
  note: string | null;
  /** The report document; null once it was deleted. */
  reportId: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface AuditList {
  items: Audit[];
  /** Auditors and admins (server: FinanceAccess.mayConfirmAudit). */
  mayConfirm: boolean;
  checkedUntil: string | null;
}

export type ExportFormat = 'CSV' | 'XLSX';

export interface BudgetLine {
  category: string;
  plannedCents: number;
  /** Booked in the season, positive in the category's direction (a Storno lowers it). */
  actualCents: number;
}

/** Every category planned or booked in the season. */
export interface Budget {
  season: number;
  items: BudgetLine[];
}

export interface Invoice {
  id: string;
  counterparty: string;
  text: string;
  /** positive; the category says paid (OUT) or collected (IN) */
  amountCents: number;
  /** YYYY-MM-DD */
  dueOn: string;
  category: string;
  note: string | null;
  /** The booking that paid it; null while open. */
  bookingId: string | null;
  /** Its task for who keeps the books. */
  taskId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type InvoiceInput = Pick<Invoice, 'counterparty' | 'text' | 'amountCents' | 'dueOn' | 'category' | 'note'>;

export interface InvoiceList {
  items: Invoice[];
  truncated: boolean;
}

/** Where fee payments are booked (an income category), when fees are due and how often overdue ones are reminded. */
export interface FeeSettings {
  category: string;
  /** days after the season starts */
  dueDays: number;
  /** 0 = no reminders */
  remindDays: number;
  /** how members pay (bank account, reference), shown with their open fees */
  instructions: string | null;
  /** the club account for the bank QR code: holder and IBAN together or neither */
  holder: string | null;
  iban: string | null;
  bic: string | null;
}

/** The sections of the Buchhaltung page, each a window (`finance-section`). */
export const FINANCE_SECTIONS: Record<string, string> = {
  balances: 'Kontostände',
  invoices: 'Offene Rechnungen',
  audits: 'Kassenprüfung',
  budget: 'Budget',
  fees: 'Mitgliedsbeiträge',
};

/** The windows of the fee settings in Einstellungen › Buchhaltung. */
export const FEE_PARTS: Record<string, string> = { due: 'Fälligkeit und Erinnerung', payment: 'Bezahlen' };

/** GET /me/fees */
export interface MyFees {
  items: Charge[];
  instructions: string | null;
}

export interface FeeRate {
  /** a membership kind */
  kind: string;
  cents: number;
  /** null = minors pay `cents` too */
  minorCents: number | null;
}

export interface FeeRates {
  season: number;
  items: FeeRate[];
}

export type ChargeStatus = 'OPEN' | 'PARTIAL' | 'PAID' | 'WAIVED';

/** One payment: a booking; a Storno cancels it. */
export interface FeePayment {
  bookingId: string;
  paidOn: string;
  amountCents: number;
  reversed: boolean;
}

/** A member's fee of one season. */
export interface Charge {
  id: string;
  season: number;
  memberId: string;
  kind: string;
  amountCents: number;
  paidCents: number;
  status: ChargeStatus;
  dueOn: string;
  note: string | null;
  payments: FeePayment[];
  /** where to pay online; null while payments are entered by hand */
  payUrl: string | null;
  /** the SEPA QR text (EPC) for the open rest; null when settled, without club account or not in EUR */
  bankQr: string | null;
  updatedAt: string;
}

export interface ChargeList {
  items: Charge[];
}

type StatusTag = { label: string; tone: 'blue' | 'yellow' | 'green' | 'gray' | 'red' };

export const CHARGE_STATUS: Record<ChargeStatus, StatusTag> = {
  OPEN: { label: 'Offen', tone: 'blue' },
  PARTIAL: { label: 'Teilweise bezahlt', tone: 'yellow' },
  PAID: { label: 'Bezahlt', tone: 'green' },
  WAIVED: { label: 'Erlassen', tone: 'gray' },
};

/** The status tag; an open rest past its due day shows as overdue. */
export const chargeStatus = (c: Pick<Charge, 'status' | 'dueOn'>, today: string): StatusTag =>
  (c.status === 'OPEN' || c.status === 'PARTIAL') && c.dueOn < today ? { label: 'Überfällig', tone: 'red' } : CHARGE_STATUS[c.status];

const ORDER: readonly FinanceLevel[] = ['NONE', 'READ', 'AUDIT', 'WRITE'];

/** server: FinanceAccess.require — the level reaches `min`. */
export const reaches = (level: FinanceLevel | undefined, min: FinanceLevel): boolean => ORDER.indexOf(level ?? 'NONE') >= ORDER.indexOf(min);

/** Transfers, reversals and reversed bookings stay as they are (server: finance.booking-fixed). */
export const isFixed = (b: Booking): boolean => !!b.transferId || !!b.reversesId || !!b.reversedBy;

/** '12,50 €' in the club's locale and currency. */
export function formatMoney(cents: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
}

/** '12,50', '12.5', '1.200,00' or '12' → cents; null for anything else (at most two decimals). */
export function parseMoney(text: string): number | null {
  const t = text.trim().replace(/\s/g, '');
  const match = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/.exec(t) ?? /^(\d+)(?:\.(\d{1,2}))?$/.exec(t);
  if (!match) return null;
  return Number(match[1].replace(/\./g, '')) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}

/** 12,50 for an amount field (without currency). */
export const moneyInput = (cents: number): string => (Math.abs(cents) / 100).toFixed(2).replace('.', ',');

/** The season `today` falls in, named by its first year (server: ListBookings.season). */
export function seasonOf(today: string, startMonth: number): number {
  const [year, month] = today.split('-').map(Number);
  return month >= startMonth ? year : year - 1;
}

/** 2026 → '2026/27'; with start month 1 the season is the calendar year. */
export const seasonLabel = (season: number, startMonth: number): string =>
  startMonth === 1 ? String(season) : `${season}/${String((season + 1) % 100).padStart(2, '0')}`;
