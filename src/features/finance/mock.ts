// Mock of the club-server finance module (FinanceHandlers, AuditHandlers): the books by finance level, transfers, Storno, receipts,
// Kassenprüfungen that lock the checked period, the journal export (InvoiceHandlers too: budget and open invoices with their tasks).
import { settings } from '../../settings';
import { directory, MockDirectory, personalData } from '../../lib/mock/core';
import { MockServer, mockServer, type MockRequest } from '../../lib/mock/MockServer';
import { MockTable } from '../../lib/mock/MockTable';
import { resolveRef } from '../../lib/mock/recordRefs';
import { fill, p, template } from '../../lib/mock/wordTemplate';
import type { LinkedRef, RefKind } from '../../lib/records/refs';
import type { FinanceLevel, Member } from '../../lib/types';
import { files } from '../files/mock';
import { tasks } from '../tasks/mock';
import {
  formatMoney,
  reaches,
  seasonLabel,
  seasonOf,
  type Account,
  type Audit,
  type Booking,
  type Budget,
  type Category,
  type Charge,
  type Direction,
  type ExportFormat,
  type FeePayment,
  type FeeRate,
  type FeeSettings,
  type Invoice,
} from './model';

const fail = MockServer.fail;
const limits = settings.finance;
/** server: FinanceApi.RECEIPT_FOLDER */
const RECEIPT_FOLDER = 'Buchhaltung';

type StoredAccount = Omit<Account, 'inUse' | 'balanceCents'>;
type StoredCategory = Omit<Category, 'inUse'>;
type StoredBooking = Omit<Booking, 'transferAccount' | 'reversedBy' | 'locked'>;
type StoredAudit = Omit<Audit, 'title'>;
type StoredInvoice = Omit<Invoice, 'taskId'>;
type StoredCharge = Omit<Charge, 'paidCents' | 'status' | 'payments' | 'payUrl' | 'bankQr'> & {
  waived: boolean;
  createdAt: string;
  remindedAt: string | null;
};
/** server: InvoiceHandlers.LIST_CAP */
const INVOICE_CAP = 500;
/** server: AuditHandlers.TEMPLATE */
const AUDIT_TEMPLATE = 'Bericht Kassenprüfung.dotx';
const day = (iso: string) =>
  new Intl.DateTimeFormat('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${iso}T12:00:00Z`));

const key = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;

export class MockFinance {
  readonly accounts = new MockTable<StoredAccount[]>('finance-accounts', () => MockFinance.seedAccounts());
  readonly categories = new MockTable<StoredCategory[]>('finance-categories', () => MockFinance.seedCategories());
  readonly bookings = new MockTable<StoredBooking[]>('finance-bookings', () => MockFinance.seedBookings());
  readonly audits = new MockTable<StoredAudit[]>('finance-audits', () => []);
  /** season → category → planned cents */
  readonly budgets = new MockTable<Record<string, Record<string, number>>>('finance-budget', () => ({}));
  readonly invoices = new MockTable<StoredInvoice[]>('finance-invoices', () => []);
  readonly feeSettings = new MockTable<FeeSettings>('finance-fee-settings', () => ({
    category: 'FEES',
    dueDays: 30,
    remindDays: 14,
    instructions: 'Bitte überweise auf unser Vereinskonto oder scanne den QR-Code mit deiner Banking-App.',
    holder: 'SV Muster',
    iban: 'AT611904300234573201',
    bic: null,
  }));
  /** season → rates */
  readonly feeRates = new MockTable<Record<string, FeeRate[]>>('finance-fee-rates', () => MockFinance.seedRates());
  readonly charges = new MockTable<StoredCharge[]>('finance-fee-charges', () => MockFinance.seedCharges());
  /** server: finance_fee_payment (a booking per payment) */
  readonly feePayments = new MockTable<{ bookingId: string; chargeId: string }[]>('finance-fee-payments', () => [
    { bookingId: 'b-fee-spielerin', chargeId: 'fee-spielerin' },
    { bookingId: 'b-fee-spieler', chargeId: 'fee-spieler' },
  ]);

  constructor() {
    // server: FinanceRepository.renameMemberRefs (GDPR erasure)
    mockServer.events.subscribe((event) => {
      if (event.type !== 'members.member-erased') return;
      const memberId = (event.data as { memberId: string }).memberId;
      for (const b of this.bookings.data) for (const r of b.refs) if (r.kind === 'MEMBER' && r.id === memberId) r.title = MockDirectory.ERASED_NAME;
      this.bookings.save();
      // server: FeeHandlers, charge notes may name the member
      for (const c of this.charges.data) if (c.memberId === memberId) c.note = null;
      this.charges.save();
    });
  }

  /** server: FinanceAccess.require */
  require(member: Member, min: FinanceLevel): Member {
    if (!reaches(directory.financeLevel(member), min)) fail(403, 'finance.forbidden');
    return member;
  }

  accountList(): Account[] {
    return [...this.accounts.data]
      .sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label, 'de'))
      .map((a) => {
        const own = this.bookings.data.filter((b) => b.account === a.key);
        return { ...a, inUse: own.length > 0, balanceCents: own.reduce((sum, b) => sum + b.amountCents, 0) };
      });
  }

  categoryList(): Category[] {
    return [...this.categories.data]
      .sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label, 'de'))
      .map((c) => ({ ...c, inUse: this.categoryInUse(c.key) }));
  }

  saveAccount(key_: string | null, body: Record<string, any>): Account {
    const label = MockFinance.label(body.label, 'finance-account.invalid');
    const row = key_ ? (this.accounts.data.find((a) => a.key === key_) ?? fail(404, 'finance-account.not-found')) : null;
    const saved: StoredAccount = { key: row?.key ?? key('ACC'), label, sort: Number(body.sort) || 0, archived: !!body.archived };
    if (row) Object.assign(row, saved);
    else this.accounts.data.push(saved);
    this.accounts.save();
    this.changed(null);
    return this.accountList().find((a) => a.key === saved.key)!;
  }

  deleteAccount(key_: string): void {
    const at = this.accounts.data.findIndex((a) => a.key === key_);
    if (at < 0) fail(404, 'finance-account.not-found');
    if (this.bookings.data.some((b) => b.account === key_)) fail(409, 'finance-account.in-use');
    this.accounts.data.splice(at, 1);
    this.accounts.save();
    this.changed(null);
  }

  saveCategory(key_: string | null, body: Record<string, any>): Category {
    const label = MockFinance.label(body.label, 'finance-category.invalid');
    const direction: Direction = body.direction === 'IN' || body.direction === 'OUT' ? body.direction : fail(400, 'finance-category.invalid');
    const row = key_ ? (this.categories.data.find((c) => c.key === key_) ?? fail(404, 'finance-category.not-found')) : null;
    if (row && row.direction !== direction && this.bookings.data.some((b) => b.category === row.key)) fail(409, 'finance-category.in-use');
    const saved: StoredCategory = { key: row?.key ?? key('CAT'), label, direction, sort: Number(body.sort) || 0, archived: !!body.archived };
    if (row) Object.assign(row, saved);
    else this.categories.data.push(saved);
    this.categories.save();
    this.changed(null);
    return this.categoryList().find((c) => c.key === saved.key)!;
  }

  deleteCategory(key_: string): void {
    const at = this.categories.data.findIndex((c) => c.key === key_);
    if (at < 0) fail(404, 'finance-category.not-found');
    if (this.categoryInUse(key_)) fail(409, 'finance-category.in-use');
    this.categories.data.splice(at, 1);
    this.categories.save();
    this.changed(null);
  }

  /** server: FinanceHandlers.list — one season from the club's start month, newest first. */
  list(season: number): { items: Booking[]; truncated: boolean } {
    const { from, to } = this.season(season);
    const rows = this.bookings.data
      .filter((b) => b.bookedOn >= from && b.bookedOn < to)
      .sort((a, b) => b.bookedOn.localeCompare(a.bookedOn) || b.createdAt.localeCompare(a.createdAt));
    return { items: rows.slice(0, limits.listCap).map((b) => this.dto(b)), truncated: rows.length > limits.listCap };
  }

  get(id: string): Booking {
    return this.dto(this.row(id));
  }

  create(viewer: Member, body: Record<string, any>): Booking {
    const now = new Date().toISOString();
    const checked = this.checked(viewer, body, null);
    this.requireOpen(checked.bookedOn);
    const row: StoredBooking = {
      id: crypto.randomUUID(),
      ...checked,
      transferId: null,
      reversesId: null,
      receipts: [],
      createdBy: viewer.id,
      createdAt: now,
      updatedAt: now,
    };
    this.bookings.data.push(row);
    this.bookings.save();
    this.changed(row.id);
    return this.dto(row);
  }

  update(viewer: Member, id: string, body: Record<string, any>): Booking {
    const row = this.row(id);
    if (this.fixed(row)) fail(409, 'finance.booking-fixed');
    const checked = this.checked(viewer, body, row);
    this.requireOpen(row.bookedOn, checked.bookedOn);
    Object.assign(row, checked, { updatedAt: new Date().toISOString() });
    this.bookings.save();
    this.changed(row.id);
    return this.dto(row);
  }

  delete(id: string): void {
    const row = this.row(id);
    const legs = row.transferId ? this.bookings.data.filter((b) => b.transferId === row.transferId) : [row];
    if (legs.some((b) => this.reversedBy(b))) fail(409, 'finance.booking-fixed');
    // server: FK finance_invoice.booking_id (restrict)
    if (this.invoices.data.some((i) => legs.some((b) => b.id === i.bookingId))) fail(409, 'data.conflict');
    this.requireOpen(...legs.map((b) => b.bookedOn));
    for (const leg of legs) this.bookings.data.splice(this.bookings.data.indexOf(leg), 1);
    this.bookings.save();
    // server: finance_fee_payment ON DELETE CASCADE
    for (const p of this.feePayments.data.filter((p) => legs.some((b) => b.id === p.bookingId)))
      this.feePayments.data.splice(this.feePayments.data.indexOf(p), 1);
    this.feePayments.save();
    for (const leg of legs) for (const r of leg.receipts) files.deleteSystemFile(r.fileId);
    this.changed(row.id);
  }

  transfer(viewer: Member, body: Record<string, any>): Booking {
    const from = this.account(body.from, null);
    const to = this.account(body.to, null);
    if (from === to) fail(400, 'finance.transfer-invalid');
    const amount = MockFinance.amount(body.amountCents);
    if (amount < 0) fail(400, 'finance.transfer-invalid');
    const bookedOn = MockFinance.date(body.bookedOn);
    this.requireOpen(bookedOn);
    const transferId = crypto.randomUUID();
    const now = new Date().toISOString();
    const leg = (account: string, amountCents: number): StoredBooking => ({
      id: crypto.randomUUID(),
      bookedOn,
      account,
      category: null,
      amountCents,
      text: MockFinance.text(body.text),
      note: MockFinance.note(body.note),
      transferId,
      reversesId: null,
      refs: [],
      receipts: [],
      createdBy: viewer.id,
      createdAt: now,
      updatedAt: now,
    });
    const out = leg(from, -amount);
    this.bookings.data.push(out, leg(to, amount));
    this.bookings.save();
    this.changed(out.id);
    return this.dto(out);
  }

  /** server: FinanceHandlers.reverse — the opposite amount, today; a transfer gets both legs reversed. */
  reverse(viewer: Member, id: string): Booking {
    const row = this.row(id);
    if (row.reversesId) fail(409, 'finance.booking-fixed');
    if (this.reversedBy(row)) fail(409, 'finance.already-reversed');
    const legs = row.transferId ? this.bookings.data.filter((b) => b.transferId === row.transferId) : [row];
    this.requireOpen(directory.clock.today());
    const transferId = row.transferId ? crypto.randomUUID() : null;
    const now = new Date().toISOString();
    const reversals = legs.map((leg): StoredBooking => ({
      ...leg,
      id: crypto.randomUUID(),
      bookedOn: directory.clock.today(),
      amountCents: -leg.amountCents,
      transferId,
      reversesId: leg.id,
      refs: [],
      receipts: [],
      createdBy: viewer.id,
      createdAt: now,
      updatedAt: now,
    }));
    this.bookings.data.push(...reversals);
    this.bookings.save();
    this.changed(row.id);
    return this.dto(reversals[legs.indexOf(row)]);
  }

  async addReceipt(viewer: Member, id: string, body: unknown): Promise<Booking> {
    const row = this.row(id);
    this.requireOpen(row.bookedOn);
    if (row.receipts.length >= limits.maxReceipts) fail(409, 'finance.too-many-receipts');
    const file = body instanceof FormData ? body.get('file') : null;
    if (!(file instanceof Blob)) return fail(400, 'request.invalid');
    const stored = await files.storeSystemFile(viewer, RECEIPT_FOLDER, file);
    row.receipts.push({ fileId: stored.id, name: stored.name });
    this.bookings.save();
    this.changed(row.id);
    return this.dto(row);
  }

  removeReceipt(id: string, fileId: string): Booking {
    const row = this.row(id);
    if (!row.receipts.some((r) => r.fileId === fileId)) fail(404, 'file.not-found');
    this.requireOpen(row.bookedOn);
    row.receipts = row.receipts.filter((r) => r.fileId !== fileId);
    this.bookings.save();
    files.deleteSystemFile(fileId);
    this.changed(row.id);
    return this.dto(row);
  }

  receiptLink(id: string, fileId: string) {
    if (!this.row(id).receipts.some((r) => r.fileId === fileId)) fail(404, 'file.not-found');
    return files.systemFileLink(fileId);
  }

  /** server: FinanceHandlers.search — for READ and up. */
  search(viewer: Member, needle: string, limit: number): Booking[] {
    if (!reaches(directory.financeLevel(viewer), 'READ')) return [];
    return this.bookings.data
      .filter((b) => b.text.toLocaleLowerCase().includes(needle) || !!b.note?.toLocaleLowerCase().includes(needle))
      .sort((a, b) => b.bookedOn.localeCompare(a.bookedOn))
      .slice(0, limit)
      .map((b) => this.dto(b));
  }

  /** server: AuditHandlers.list */
  auditList(viewer: Member): { items: Audit[]; mayConfirm: boolean; checkedUntil: string | null } {
    const items = [...this.audits.data].sort((a, b) => b.checkedUntil.localeCompare(a.checkedUntil)).map((a) => MockFinance.audit(a));
    return { items, mayConfirm: this.mayConfirm(viewer), checkedUntil: this.checkedUntil() };
  }

  /** server: AuditHandlers GET_AUDIT — for readers of the books (also RecordRefs). */
  audit(viewer: Member, id: string): Audit {
    this.require(viewer, 'READ');
    return MockFinance.audit(this.audits.data.find((a) => a.id === id) ?? fail(404, 'finance.not-found'));
  }

  /** server: FinanceAccess.confirmsAudits — an office with level AUDIT, or an admin; the Kassier does not check themselves. */
  mayConfirm(viewer: Member): boolean {
    if (viewer.roles.includes('ADMIN')) return true;
    const held = directory.officesOf(viewer.id);
    return directory.boardSettings.data.offices.some((o) => held.includes(o.office) && o.finance === 'AUDIT');
  }

  /** server: AuditHandlers.confirm — before today and after the last check; stores the report, then locks the period. */
  async confirmAudit(viewer: Member, body: Record<string, any>): Promise<Audit> {
    if (!this.mayConfirm(viewer)) fail(403, 'finance.forbidden');
    const until =
      typeof body.checkedUntil === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.checkedUntil) ? body.checkedUntil : fail(400, 'request.invalid');
    const note = typeof body.note === 'string' ? body.note.trim() || null : null;
    if (note && note.length > limits.noteMaxLength) fail(400, 'finance.audit-invalid');
    const last = this.checkedUntil();
    if (until >= directory.clock.today() || (last && until <= last)) fail(400, 'finance.audit-date-invalid');
    const { default: JSZip } = await import('jszip');
    const builtIn = () => MockFinance.auditTemplate(JSZip);
    const report = await fill(
      JSZip,
      await files.settingTemplate(viewer, 'AUDIT_TEMPLATE', AUDIT_TEMPLATE, builtIn),
      this.report(viewer, until, last, note),
      'Konten',
      this.balances(until),
    );
    const title = `Kassenprüfung bis ${day(until)}`;
    const stored = await files.storeSystemFile(viewer, RECEIPT_FOLDER, new File([report], `${title}.docx`));
    const audit: StoredAudit = {
      id: crypto.randomUUID(),
      checkedUntil: until,
      note,
      reportId: stored.id,
      createdBy: viewer.id,
      createdAt: new Date().toISOString(),
    };
    this.audits.data.push(audit);
    this.audits.save();
    this.changed(null);
    return MockFinance.audit(audit);
  }

  auditReportLink(viewer: Member, id: string) {
    const audit = this.audit(viewer, id);
    return audit.reportId ? files.systemFileLink(audit.reportId) : fail(404, 'finance.not-found');
  }

  searchAudits(viewer: Member, needle: string, limit: number): Audit[] {
    if (!reaches(directory.financeLevel(viewer), 'READ')) return [];
    return this.auditList(viewer)
      .items.filter((a) => `${a.title} ${a.note ?? ''}`.toLocaleLowerCase().includes(needle))
      .slice(0, limit);
  }

  /** server: FinanceHandlers.export + JournalExport — the season oldest first, labels resolved. */
  async exportJournal(season: number, format: ExportFormat): Promise<Blob> {
    const label = (key: string | null) => (key ? (this.accounts.data.find((a) => a.key === key)?.label ?? key) : null);
    const items = this.list(season).items.reverse();
    const category = (key: string | null) => (key ? (this.categories.data.find((c) => c.key === key)?.label ?? key) : null);
    const lines = items.map((b) => [b.bookedOn, label(b.account), category(b.category), label(b.transferAccount), b.text, b.note]);
    const amounts = items.map((b) => b.amountCents / 100);
    const header = ['Datum', 'Konto', 'Kategorie', 'Gegenkonto', 'Text', 'Notiz', 'Betrag'];
    if (format === 'CSV') {
      const cell = (v: string | null) => (v === null ? '' : `"${(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`);
      const rows = lines.map((l, i) => [...l.map(cell), amounts[i].toFixed(2).replace('.', ',')].join(';'));
      return new Blob([`\uFEFF${[header.join(';'), ...rows].join('\r\n')}\r\n`], { type: 'text/csv;charset=utf-8' });
    }
    const { default: JSZip } = await import('jszip');
    const text = (v: string | null) =>
      v === null
        ? '<c/>'
        : `<c t="inlineStr"><is><t xml:space="preserve">${v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</t></is></c>`;
    const rows = [header.map(text), ...lines.map((l, i) => [...l.map(text), `<c t="n"><v>${amounts[i].toFixed(2)}</v></c>`])]
      .map((cells, i) => `<row r="${i + 1}">${cells.join('')}</row>`)
      .join('');
    const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    const rel = (type: string, target: string) =>
      `${xml}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/></Relationships>`;
    const zip = new JSZip();
    zip.file(
      '[Content_Types].xml',
      `${xml}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    );
    zip.file('_rels/.rels', rel('officeDocument', 'xl/workbook.xml'));
    zip.file(
      'xl/workbook.xml',
      `${xml}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Journal" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    );
    zip.file('xl/_rels/workbook.xml.rels', rel('worksheet', 'worksheets/sheet1.xml'));
    zip.file(
      'xl/worksheets/sheet1.xml',
      `${xml}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`,
    );
    return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  /** server: FinanceHandlers.budget — categories planned or booked in the season, actual signed by direction. */
  budget(season: number): Budget {
    const planned = this.budgets.data[season] ?? {};
    const { from, to } = this.season(season);
    const actual: Record<string, number> = {};
    for (const b of this.bookings.data)
      if (b.category && b.bookedOn >= from && b.bookedOn < to) actual[b.category] = (actual[b.category] ?? 0) + b.amountCents;
    const items = this.categoryList()
      .filter((c) => c.key in planned || c.key in actual)
      .map((c) => ({ category: c.key, plannedCents: planned[c.key] ?? 0, actualCents: (c.direction === 'IN' ? 1 : -1) * (actual[c.key] ?? 0) }));
    return { season, items };
  }

  /** server: FinanceHandlers.saveBudget */
  saveBudget(season: number, body: Record<string, any>): Budget {
    const planned: Record<string, number> = {};
    for (const item of Array.isArray(body.items) ? body.items : []) {
      const cents = Number(item?.plannedCents);
      if (
        !item ||
        !Number.isInteger(cents) ||
        cents < 0 ||
        cents > limits.maxCents ||
        !this.categories.data.some((c) => c.key === item.category) ||
        item.category in planned
      )
        fail(400, 'finance.budget-invalid');
      if (cents) planned[item.category] = cents;
    }
    this.budgets.data[season] = planned;
    this.budgets.save();
    this.changed(null);
    return this.budget(season);
  }

  /** server: InvoiceHandlers.list — open first (soonest due), then paid (latest due). */
  invoiceList(): { items: Invoice[]; truncated: boolean } {
    const rows = [...this.invoices.data].sort(
      (a, b) =>
        Number(!!a.bookingId) - Number(!!b.bookingId) ||
        (a.bookingId ? b.dueOn.localeCompare(a.dueOn) : a.dueOn.localeCompare(b.dueOn)) ||
        b.createdAt.localeCompare(a.createdAt),
    );
    return { items: this.invoiceDtos(rows.slice(0, INVOICE_CAP)), truncated: rows.length > INVOICE_CAP };
  }

  invoice(id: string): Invoice {
    return this.invoiceDtos([this.invoiceRow(id)])[0];
  }

  /** server: InvoiceHandlers.save — a new one becomes a task for who keeps the books; a moved due date moves it. */
  saveInvoice(viewer: Member, id: string | null, body: Record<string, any>): Invoice {
    const old = id ? this.invoiceRow(id) : null;
    if (old?.bookingId) fail(409, 'finance.invoice-paid');
    const category = this.categories.data.find((c) => c.key === body.category && (!c.archived || c.key === old?.category));
    if (!category) return fail(400, 'finance.category-unknown');
    const str = (v: unknown, max: number, required: boolean) => {
      const t = typeof v === 'string' ? v.trim() : '';
      return t.length > max || (required && !t) ? fail(400, 'finance.invoice-invalid') : t || null;
    };
    const amount = Number(body.amountCents);
    if (!Number.isInteger(amount) || amount <= 0 || amount > limits.maxCents) fail(400, 'finance.amount-invalid');
    const now = new Date().toISOString();
    const row: StoredInvoice = {
      id: old?.id ?? crypto.randomUUID(),
      counterparty: str(body.counterparty, 120, true)!,
      text: str(body.text, limits.textMaxLength, true)!,
      amountCents: amount,
      dueOn: typeof body.dueOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.dueOn) ? body.dueOn : fail(400, 'request.invalid'),
      category: category.key,
      note: str(body.note, limits.noteMaxLength, false),
      bookingId: null,
      createdBy: old?.createdBy ?? viewer.id,
      createdAt: old?.createdAt ?? now,
      updatedAt: now,
    };
    const moved = !!old && old.dueOn !== row.dueOn;
    if (old) Object.assign(old, row);
    else this.invoices.data.push(row);
    this.invoices.save();
    this.changed(null);
    if (!old) {
      const title = `${category.direction === 'OUT' ? 'Rechnung bezahlen' : 'Zahlung einholen'}: ${row.counterparty} – ${row.text}`;
      mockServer.events.publish({
        type: 'finance.invoice-opened',
        data: {
          invoiceId: row.id,
          title,
          description: `${row.counterparty}: ${row.text}, ${this.money(row.amountCents)}`,
          dueAt: MockFinance.dueAt(row.dueOn),
          assignees: this.keepers(),
          createdBy: row.createdBy,
        },
      });
    } else if (moved) {
      // shortcut: like the server, only the due date reaches the task
      tasks.moveSourced('FINANCE_INVOICE', row.id, MockFinance.dueAt(row.dueOn));
    }
    return this.invoice(row.id);
  }

  deleteInvoice(viewer: Member, id: string): void {
    const row = this.invoiceRow(id);
    if (row.bookingId) fail(409, 'finance.invoice-paid');
    this.invoices.data.splice(this.invoices.data.indexOf(row), 1);
    this.invoices.save();
    this.changed(null);
    mockServer.events.publish({ type: 'finance.invoice-dropped', data: { invoiceId: id, by: viewer.id } });
  }

  /** server: InvoiceHandlers.pay — one booking in the invoice's category; its task is done. */
  payInvoice(viewer: Member, id: string, body: Record<string, any>): Invoice {
    const row = this.invoiceRow(id);
    if (row.bookingId) fail(409, 'finance.invoice-paid');
    const account = this.account(body.account, null);
    const category = this.categories.data.find((c) => c.key === row.category)!;
    const on = body.paidOn == null ? directory.clock.today() : MockFinance.date(body.paidOn);
    this.requireOpen(on);
    const now = new Date().toISOString();
    const booking: StoredBooking = {
      id: crypto.randomUUID(),
      bookedOn: on,
      account,
      category: category.key,
      amountCents: category.direction === 'IN' ? row.amountCents : -row.amountCents,
      text: `${row.counterparty}: ${row.text}`.slice(0, limits.textMaxLength),
      note: null,
      transferId: null,
      reversesId: null,
      refs: [],
      receipts: [],
      createdBy: viewer.id,
      createdAt: now,
      updatedAt: now,
    };
    this.bookings.data.push(booking);
    this.bookings.save();
    row.bookingId = booking.id;
    this.invoices.save();
    this.changed(booking.id);
    mockServer.events.publish({ type: 'finance.invoice-paid', data: { invoiceId: id, by: viewer.id } });
    return this.invoice(id);
  }

  /** server: InvoiceHandlers.search */
  searchInvoices(viewer: Member, needle: string, limit: number): Invoice[] {
    if (!reaches(directory.financeLevel(viewer), 'READ')) return [];
    const rows = this.invoices.data
      .filter((i) => [i.counterparty, i.text, i.note ?? ''].some((t) => t.toLocaleLowerCase().includes(needle)))
      .sort((a, b) => Number(!!a.bookingId) - Number(!!b.bookingId) || b.dueOn.localeCompare(a.dueOn))
      .slice(0, limit);
    return this.invoiceDtos(rows);
  }

  // --- membership fees (server: FeeHandlers) ---

  saveFeeSettings(body: Record<string, any>): FeeSettings {
    const dueDays = Number(body.dueDays);
    const remindDays = Number(body.remindDays);
    const category = this.categories.data.find((c) => c.key === body.category && c.direction === 'IN');
    const instructions = typeof body.instructions === 'string' ? body.instructions.trim() : '';
    if (!category || ![dueDays, remindDays].every((n) => Number.isInteger(n) && n >= 0 && n <= 365) || instructions.length > 2000)
      fail(400, 'finance.fee-invalid');
    const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
    const holder = text(body.holder);
    const iban = text(body.iban)?.replaceAll(' ', '').toUpperCase() ?? null;
    const bic = text(body.bic)?.replaceAll(' ', '').toUpperCase() ?? null;
    if (
      (holder?.length ?? 0) > 70 ||
      (iban !== null && !ibanValid(iban)) ||
      (bic !== null && !/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic)) ||
      (holder === null) !== (iban === null) ||
      (iban === null && bic !== null)
    )
      fail(400, 'finance.bank-invalid');
    Object.assign(this.feeSettings.data, { category: category!.key, dueDays, remindDays, instructions: instructions || null, holder, iban, bic });
    this.feeSettings.save();
    this.changed(null);
    return { ...this.feeSettings.data };
  }

  rates(season: number): { season: number; items: FeeRate[] } {
    return { season, items: [...(this.feeRates.data[season] ?? [])].sort((a, b) => a.kind.localeCompare(b.kind)) };
  }

  saveRates(season: number, body: Record<string, any>): { season: number; items: FeeRate[] } {
    const items: FeeRate[] = [];
    const ok = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= limits.maxCents;
    for (const r of Array.isArray(body.items) ? body.items : []) {
      const minorCents = r?.minorCents ?? null;
      if (
        !r ||
        typeof r.kind !== 'string' ||
        !r.kind.trim() ||
        items.some((i) => i.kind === r.kind) ||
        !ok(r.cents) ||
        (minorCents !== null && !ok(minorCents))
      )
        fail(400, 'finance.fee-invalid');
      items.push({ kind: r.kind, cents: r.cents, minorCents });
    }
    this.feeRates.data[season] = items;
    this.feeRates.save();
    this.changed(null);
    return this.rates(season);
  }

  chargeList(season: number): { items: Charge[] } {
    const rows = this.charges.data
      .filter((c) => c.season === season)
      .sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.createdAt.localeCompare(b.createdAt));
    return { items: rows.map((c) => this.chargeDto(c)) };
  }

  charge(id: string): Charge {
    return this.chargeDto(this.chargeRow(id));
  }

  /** The highest rate among the member's kinds; minors pay the minor rate where set. Members charged already keep theirs. */
  generate(season: number): { items: Charge[] } {
    const rates = new Map((this.feeRates.data[season] ?? []).map((r) => [r.kind, r]));
    const month = String(directory.clubInfo().seasonStartMonth).padStart(2, '0');
    const due = new Date(`${season}-${month}-01T12:00:00Z`);
    due.setUTCDate(due.getUTCDate() + this.feeSettings.data.dueDays);
    const now = new Date().toISOString();
    for (const m of directory.members.data) {
      if (!m.active || !m.membershipTypes.length || this.charges.data.some((c) => c.season === season && c.memberId === m.id)) continue;
      const minor = directory.underAge(m.id);
      let kind: string | null = null;
      let amount = 0;
      for (const k of m.membershipTypes) {
        const r = rates.get(k);
        const cents = !r ? 0 : minor && r.minorCents !== null ? r.minorCents : r.cents;
        if (cents > amount) [kind, amount] = [k, cents];
      }
      if (kind)
        this.charges.data.push({
          id: crypto.randomUUID(),
          season,
          memberId: m.id,
          kind,
          amountCents: amount,
          waived: false,
          dueOn: due.toISOString().slice(0, 10),
          note: null,
          remindedAt: null,
          createdAt: now,
          updatedAt: now,
        });
    }
    this.charges.save();
    this.changed(null);
    return this.chargeList(season);
  }

  adjustCharge(id: string, body: Record<string, any>): Charge {
    const row = this.chargeRow(id);
    const amount = Number(body.amountCents);
    const note = typeof body.note === 'string' ? body.note.trim() : '';
    if (!Number.isInteger(amount) || amount < 0 || amount > limits.maxCents || note.length > limits.noteMaxLength) fail(400, 'finance.fee-invalid');
    if (amount < this.paid(id)) fail(400, 'finance.fee-invalid');
    Object.assign(row, { amountCents: amount, waived: !!body.waived, note: note || null, updatedAt: new Date().toISOString() });
    this.charges.save();
    this.changed(null);
    return this.charge(id);
  }

  deleteCharge(id: string): void {
    const row = this.chargeRow(id);
    if (this.feePayments.data.some((p) => p.chargeId === id)) fail(409, 'finance.charge-has-payments');
    this.charges.data.splice(this.charges.data.indexOf(row), 1);
    this.charges.save();
    this.changed(null);
  }

  /** server: FeeHandlers.remindNow — an open charge, to the member and their guardians; the scheduled one then waits an interval. */
  remindCharge(id: string): void {
    const row = this.chargeRow(id);
    const charge = this.chargeDto(row);
    if (charge.status !== 'OPEN' && charge.status !== 'PARTIAL') fail(400, 'finance.fee-invalid');
    row.remindedAt = new Date().toISOString();
    this.charges.save();
    const season = seasonLabel(row.season, directory.clubInfo().seasonStartMonth);
    mockServer.events.publish({
      type: 'finance.fee-reminder',
      data: {
        recipients: [row.memberId, ...directory.guardiansOf([row.memberId])],
        title: `Mitgliedsbeitrag ${season} offen`,
        body: `Der Mitgliedsbeitrag ${season} für ${directory.name(row.memberId) ?? ''} ist seit ${day(row.dueOn)} fällig; offen sind noch ${this.money(row.amountCents - charge.paidCents)}.`,
        link: `/members/${row.memberId}`,
      },
    });
  }

  /** A booking in the fee category, linked to the member; the text names the season only. */
  payCharge(viewer: Member, id: string, body: Record<string, any>): Charge {
    const account = this.account(body.account, null);
    const amount = Number(body.amountCents);
    if (!Number.isInteger(amount) || amount <= 0) fail(400, 'finance.amount-invalid');
    const row = this.chargeRow(id);
    if (amount > row.amountCents - this.paid(id)) fail(409, 'finance.payment-too-high');
    const on = body.paidOn == null ? directory.clock.today() : MockFinance.date(body.paidOn);
    this.requireOpen(on);
    const name = directory.name(row.memberId);
    const now = new Date().toISOString();
    const booking: StoredBooking = {
      id: crypto.randomUUID(),
      bookedOn: on,
      account,
      category: this.feeSettings.data.category,
      amountCents: amount,
      text: `Mitgliedsbeitrag ${seasonLabel(row.season, directory.clubInfo().seasonStartMonth)}`,
      note: null,
      transferId: null,
      reversesId: null,
      refs: name ? [{ kind: 'MEMBER', id: row.memberId, title: name, parentId: null }] : [],
      receipts: [],
      createdBy: viewer.id,
      createdAt: now,
      updatedAt: now,
    };
    this.bookings.data.push(booking);
    this.bookings.save();
    this.feePayments.data.push({ bookingId: booking.id, chargeId: id });
    this.feePayments.save();
    this.changed(booking.id);
    return this.charge(id);
  }

  /** server: MY_FEES — the member's charges and their wards', newest season first. */
  myFees(viewer: Member): { items: Charge[]; instructions: string | null } {
    return { ...this.chargesOf([viewer.id, ...directory.wardsOf(viewer.id)]), instructions: this.feeSettings.data.instructions };
  }

  /** server: MEMBER_CHARGES, chargesOf — newest season first */
  chargesOf(ids: string[]): { items: Charge[] } {
    const rows = this.charges.data.filter((c) => ids.includes(c.memberId)).sort((a, b) => b.season - a.season || a.dueOn.localeCompare(b.dueOn));
    return { items: rows.map((c) => this.chargeDto(c)) };
  }

  private payments(chargeId: string): FeePayment[] {
    return this.feePayments.data
      .filter((p) => p.chargeId === chargeId)
      .map((p) => this.bookings.data.find((b) => b.id === p.bookingId)!)
      .sort((a, b) => a.bookedOn.localeCompare(b.bookedOn) || a.createdAt.localeCompare(b.createdAt))
      .map((b) => ({ bookingId: b.id, paidOn: b.bookedOn, amountCents: b.amountCents, reversed: !!this.reversedBy(b) }));
  }

  private paid(chargeId: string): number {
    return this.payments(chargeId)
      .filter((p) => !p.reversed)
      .reduce((sum, p) => sum + p.amountCents, 0);
  }

  /** server: Charge.status; payUrl stays null (ManualPaymentGateway); bankQr like FeeHandlers.dtos (BankQr.payload). */
  private chargeDto(row: StoredCharge): Charge {
    const payments = this.payments(row.id);
    const paidCents = payments.filter((p) => !p.reversed).reduce((sum, p) => sum + p.amountCents, 0);
    const status = paidCents >= row.amountCents ? 'PAID' : row.waived ? 'WAIVED' : paidCents > 0 ? 'PARTIAL' : 'OPEN';
    const { waived: _w, createdAt: _c, remindedAt: _r, ...rest } = row;
    const { holder, iban, bic } = this.feeSettings.data;
    const club = directory.clubInfo();
    const bankQr =
      (status === 'OPEN' || status === 'PARTIAL') && iban && club.currency === 'EUR'
        ? [
            'BCD',
            '002',
            '1',
            'SCT',
            bic ?? '',
            holder,
            iban,
            `EUR${((row.amountCents - paidCents) / 100).toFixed(2)}`,
            '',
            '',
            `Mitgliedsbeitrag ${seasonLabel(row.season, club.seasonStartMonth)} ${directory.name(row.memberId) ?? ''}`.slice(0, 140),
          ].join('\n')
        : null;
    return { ...rest, paidCents, status, payments, payUrl: null, bankQr };
  }

  private chargeRow(id: string): StoredCharge {
    return this.charges.data.find((c) => c.id === id) ?? fail(404, 'finance.not-found');
  }

  /** server: FinanceAccess.keepers — holders of a WRITE office, else the admins. */
  private keepers(): string[] {
    const writing = directory.boardSettings.data.offices.filter((o) => o.finance === 'WRITE').map((o) => o.office);
    const holders = directory
      .running()
      .filter((o) => writing.includes(o.office))
      .map((o) => o.memberId);
    return holders.length ? [...new Set(holders)] : directory.members.data.filter((m) => m.active && m.roles.includes('ADMIN')).map((m) => m.id);
  }

  private invoiceDtos(rows: StoredInvoice[]): Invoice[] {
    const found = tasks.sourced(
      'FINANCE_INVOICE',
      rows.map((i) => i.id),
    );
    return rows.map((i) => ({ ...i, taskId: found[i.id]?.taskId ?? null }));
  }

  private invoiceRow(id: string): StoredInvoice {
    return this.invoices.data.find((i) => i.id === id) ?? fail(404, 'finance.not-found');
  }

  private categoryInUse(key_: string): boolean {
    return (
      this.bookings.data.some((b) => b.category === key_) ||
      this.invoices.data.some((i) => i.category === key_) ||
      this.feeSettings.data.category === key_
    );
  }

  private season(season: number): { from: string; to: string } {
    const month = String(directory.clubInfo().seasonStartMonth).padStart(2, '0');
    return { from: `${season}-${month}-01`, to: `${season + 1}-${month}-01` };
  }

  /** Due at 23:59 club time, like a resolution's task. */
  private static dueAt(day: string): string {
    return directory.clock.toInstant(`${day}T23:59`);
  }

  private checkedUntil(): string | null {
    return this.audits.data.reduce<string | null>((max, a) => (!max || a.checkedUntil > max ? a.checkedUntil : max), null);
  }

  /** server: FinanceHandlers.requireOpen */
  private requireOpen(...days: string[]): void {
    const checked = this.checkedUntil();
    if (checked && days.some((d) => d <= checked)) fail(409, 'finance.period-checked');
  }

  /** server: AuditHandlers.content */
  private report(viewer: Member, until: string, last: string | null, note: string | null): Record<string, string | null> {
    const club = directory.clubInfo();
    const rows = this.bookings.data.filter((b) => b.category && b.bookedOn <= until && (!last || b.bookedOn > last));
    const sum = (sign: number) => rows.filter((b) => Math.sign(b.amountCents) === sign).reduce((s, b) => s + b.amountCents, 0);
    const lastDay = last ? new Date(`${last}T12:00:00Z`) : null;
    lastDay?.setUTCDate(lastDay.getUTCDate() + 1);
    return {
      Verein: club.name,
      Adresse: club.address,
      Webseite: club.website,
      Kontakt: club.contactEmail,
      Registernummer: club.registerNumber,
      Von: lastDay ? day(lastDay.toISOString().slice(0, 10)) : 'Beginn der Aufzeichnungen',
      Bis: day(until),
      Prüfer: `${viewer.firstName} ${viewer.lastName}`,
      Datum: day(directory.clock.today()),
      Buchungen: String(rows.length),
      Einnahmen: this.money(sum(1)),
      Ausgaben: this.money(-sum(-1)),
      Notiz: note,
    };
  }

  /** Each account's balance at `until`; archived ones only with money on them. */
  private balances(until: string): string[] {
    return this.accounts.data
      .map((a) => ({ a, cents: this.bookings.data.filter((b) => b.account === a.key && b.bookedOn <= until).reduce((s, b) => s + b.amountCents, 0) }))
      .filter(({ a, cents }) => !a.archived || cents !== 0)
      .map(({ a, cents }) => `${a.label}: ${this.money(cents)}`);
  }

  private money(cents: number): string {
    const club = directory.clubInfo();
    return formatMoney(cents, club.currency, club.locale);
  }

  /** server: AuditReport.defaultTemplate */
  private static auditTemplate(Zip: Parameters<typeof template>[0]): Promise<Blob> {
    return template(
      Zip,
      [
        p('Small', '{{Verein}}'),
        p('Title', 'Bericht der Kassenprüfung'),
        p('Subtitle', 'Geprüft bis {{Bis}}'),
        p(null, 'Zeitraum: {{Von}} bis {{Bis}}'),
        p(null, 'Buchungen: {{Buchungen}}'),
        p(null, 'Einnahmen: {{Einnahmen}}'),
        p(null, 'Ausgaben: {{Ausgaben}}'),
        p('Heading1', 'Kontostände am {{Bis}}'),
        p('ListParagraph', '{{Konten}}'),
        p('Heading1', 'Ergebnis'),
        p(null, '{{Notiz}}'),
        p(null, 'Bestätigt von {{Prüfer}} am {{Datum}}.'),
      ].join(''),
    );
  }

  private static audit(a: StoredAudit): Audit {
    return { ...a, title: `Kassenprüfung bis ${day(a.checkedUntil)}` };
  }

  /** server: Booking constructor, Category.requireSign and the account/category checks of FinanceHandlers. */
  private checked(viewer: Member, body: Record<string, any>, before: StoredBooking | null) {
    const account = this.account(body.account, before?.account ?? null);
    const category = this.categories.data.find((c) => c.key === body.category && (!c.archived || c.key === before?.category));
    if (!category) return fail(400, 'finance.category-unknown');
    const amountCents = MockFinance.amount(body.amountCents);
    if (amountCents > 0 !== (category.direction === 'IN')) fail(400, 'finance.direction-mismatch');
    const refs = Array.isArray(body.refs) ? (body.refs as { kind: RefKind; id: string }[]) : [];
    if (refs.length > limits.maxRefs) fail(400, 'finance.too-many-refs');
    const kept = before?.refs ?? [];
    return {
      bookedOn: MockFinance.date(body.bookedOn),
      account,
      category: category.key,
      amountCents,
      text: MockFinance.text(body.text),
      note: MockFinance.note(body.note),
      refs: refs.map((r): LinkedRef => kept.find((k) => k.kind === r.kind && k.id === r.id) ?? resolveRef(viewer, r, 'finance')),
    };
  }

  /** An archived account only where the booking already had it. */
  private account(value: unknown, kept: string | null): string {
    const found = this.accounts.data.find((a) => a.key === value && (!a.archived || a.key === kept));
    return found ? found.key : fail(400, 'finance.account-unknown');
  }

  private row(id: string): StoredBooking {
    return this.bookings.data.find((b) => b.id === id) ?? fail(404, 'finance.not-found');
  }

  private reversedBy(row: StoredBooking): string | null {
    return this.bookings.data.find((b) => b.reversesId === row.id)?.id ?? null;
  }

  private fixed(row: StoredBooking): boolean {
    return !!row.transferId || !!row.reversesId || !!this.reversedBy(row);
  }

  private dto(row: StoredBooking): Booking {
    const other = row.transferId ? this.bookings.data.find((b) => b.transferId === row.transferId && b.id !== row.id) : undefined;
    const checked = this.checkedUntil();
    return {
      ...row,
      transferAccount: other?.account ?? null,
      reversedBy: this.reversedBy(row),
      refs: [...row.refs],
      receipts: [...row.receipts],
      locked: !!checked && row.bookedOn <= checked,
    };
  }

  /** server: FinanceChanged to everyone with a finance level. */
  private changed(bookingId: string | null): void {
    const members = directory.members.data.filter((m) => m.active && directory.financeLevel(m) !== 'NONE').map((m) => m.id);
    mockServer.events.publish({ type: 'finance.finance-changed', data: { bookingId }, audience: { members } });
  }

  private static label(value: unknown, code: string): string {
    const label = typeof value === 'string' ? value.trim() : '';
    return label && label.length <= limits.labelMaxLength ? label : fail(400, code);
  }

  private static amount(value: unknown): number {
    const n = Number(value);
    return Number.isInteger(n) && n !== 0 && Math.abs(n) <= limits.maxCents ? n : fail(400, 'finance.amount-invalid');
  }

  private static date(value: unknown): string {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fail(400, 'finance.booking-invalid');
  }

  private static text(value: unknown): string {
    const text = typeof value === 'string' ? value.trim() : '';
    return text && text.length <= limits.textMaxLength ? text : fail(400, 'finance.booking-invalid');
  }

  private static note(value: unknown): string | null {
    const note = typeof value === 'string' ? value.trim() : '';
    return note.length > limits.noteMaxLength ? fail(400, 'finance.booking-invalid') : note || null;
  }

  private static seedAccounts(): StoredAccount[] {
    return [
      { key: 'BANK', label: 'Bankkonto', sort: 0, archived: false },
      { key: 'CASH', label: 'Kassa', sort: 1, archived: false },
    ];
  }

  /** server: V124__journal.sql */
  private static seedCategories(): StoredCategory[] {
    const c = (key_: string, label: string, direction: Direction, sort: number): StoredCategory => ({
      key: key_,
      label,
      direction,
      sort,
      archived: false,
    });
    return [
      c('FEES', 'Mitgliedsbeiträge', 'IN', 0),
      c('DONATIONS', 'Spenden', 'IN', 1),
      c('GRANTS', 'Förderungen', 'IN', 2),
      c('EVENTS_IN', 'Veranstaltungen', 'IN', 3),
      c('OTHER_IN', 'Sonstige Einnahmen', 'IN', 4),
      c('HALL', 'Hallenmiete', 'OUT', 10),
      c('EQUIPMENT', 'Ausrüstung', 'OUT', 11),
      c('TRAVEL', 'Fahrtkosten', 'OUT', 12),
      c('ASSOCIATION', 'Verbandsgebühren', 'OUT', 13),
      c('OTHER_OUT', 'Sonstige Ausgaben', 'OUT', 14),
    ];
  }

  /** A few bookings of the running season, so the journal has something to show. */
  private static seedBookings(): StoredBooking[] {
    const season = seasonOf(directory.clock.today(), directory.club.seasonStartMonth);
    const at = new Date().toISOString();
    const b = (id: string, bookedOn: string, account: string, category: string, amountCents: number, text: string): StoredBooking => ({
      id,
      bookedOn: `${season}-${bookedOn}`,
      account,
      category,
      amountCents,
      text,
      note: null,
      transferId: null,
      reversesId: null,
      refs: [],
      receipts: [],
      createdBy: 'admin',
      createdAt: at,
      updatedAt: at,
    });
    return [
      b('b-fees', '09-15', 'BANK', 'FEES', 240_000, 'Mitgliedsbeiträge September'),
      b('b-hall', '09-30', 'BANK', 'HALL', -85_000, 'Hallenmiete September'),
      b('b-balls', '10-04', 'BANK', 'EQUIPMENT', -32_990, 'Volleybälle Mikasa'),
      b('b-buffet', '10-12', 'CASH', 'EVENTS_IN', 41_250, 'Buffet Heimspieltag'),
      // payments of the seeded fees: Lena paid in full, David (a minor) in part
      ...[
        { ...b('b-fee-spielerin', '08-20', 'BANK', 'FEES', 12_000, 'Mitgliedsbeitrag'), member: 'spielerin' },
        { ...b('b-fee-spieler', '09-02', 'CASH', 'FEES', 3000, 'Mitgliedsbeitrag'), member: 'spieler' },
      ].map(({ member, ...booking }) => ({
        ...booking,
        text: `Mitgliedsbeitrag ${seasonLabel(season, directory.club.seasonStartMonth)}`,
        refs: [{ kind: 'MEMBER' as const, id: member, title: directory.name(member) ?? member, parentId: null }],
      })),
    ];
  }

  /** Rates of the running season: ordinary 120 (minors 60), extraordinary 150, honorary free. */
  private static seedRates(): Record<string, FeeRate[]> {
    const season = seasonOf(directory.clock.today(), directory.club.seasonStartMonth);
    return {
      [season]: [
        { kind: 'EXTRAORDINARY', cents: 15_000, minorCents: null },
        { kind: 'ORDINARY', cents: 12_000, minorCents: 6000 },
      ],
    };
  }

  /** The running season's charges, as `generate` makes them from the seeded rates. */
  private static seedCharges(): StoredCharge[] {
    const season = seasonOf(directory.clock.today(), directory.club.seasonStartMonth);
    const rates = new Map(MockFinance.seedRates()[season].map((r) => [r.kind, r]));
    const due = new Date(`${season}-${String(directory.club.seasonStartMonth).padStart(2, '0')}-01T12:00:00Z`);
    due.setUTCDate(due.getUTCDate() + 30);
    const at = new Date().toISOString();
    return directory.members.data.flatMap((m) => {
      const r = m.active ? rates.get(m.membershipTypes[0]) : undefined;
      if (!r) return [];
      const amountCents = directory.underAge(m.id) && r.minorCents !== null ? r.minorCents : r.cents;
      return [
        {
          id: `fee-${m.id}`,
          season,
          memberId: m.id,
          kind: r.kind,
          amountCents,
          waived: false,
          dueOn: due.toISOString().slice(0, 10),
          note: null,
          remindedAt: null,
          createdAt: at,
          updatedAt: at,
        },
      ];
    });
  }
}

export const finance = new MockFinance();

const reader = (req: MockRequest, min: FinanceLevel = 'READ') => finance.require(directory.actor(req), min);
const seasonParam = (req: MockRequest): number => {
  const season = Number(req.query.get('season'));
  return Number.isInteger(season) && season >= 2000 && season <= 2100 ? season : fail(400, 'request.invalid');
};

mockServer
  .on('GET', '/api/v1/finance/accounts', (req) => (reader(req), { items: finance.accountList() }))
  .on('POST', '/api/v1/finance/accounts', (req) => (reader(req, 'WRITE'), finance.saveAccount(null, req.body ?? {})))
  .on('PUT', '/api/v1/finance/accounts/:key', (req) => (reader(req, 'WRITE'), finance.saveAccount(req.params.key, req.body ?? {})))
  .on('DELETE', '/api/v1/finance/accounts/:key', (req) => (reader(req, 'WRITE'), finance.deleteAccount(req.params.key)))
  .on('GET', '/api/v1/finance/categories', (req) => (reader(req), { items: finance.categoryList() }))
  .on('POST', '/api/v1/finance/categories', (req) => (reader(req, 'WRITE'), finance.saveCategory(null, req.body ?? {})))
  .on('PUT', '/api/v1/finance/categories/:key', (req) => (reader(req, 'WRITE'), finance.saveCategory(req.params.key, req.body ?? {})))
  .on('DELETE', '/api/v1/finance/categories/:key', (req) => (reader(req, 'WRITE'), finance.deleteCategory(req.params.key)))
  .on('GET', '/api/v1/finance/bookings', (req) => {
    reader(req);
    const season = Number(req.query.get('season'));
    if (!Number.isInteger(season) || season < 2000 || season > 2100) fail(400, 'request.invalid');
    return finance.list(season);
  })
  .on('POST', '/api/v1/finance/bookings', (req) => finance.create(reader(req, 'WRITE'), req.body ?? {}))
  .on('GET', '/api/v1/finance/bookings/export', (req) => {
    reader(req);
    const season = Number(req.query.get('season'));
    const format = req.query.get('format') ?? 'CSV';
    if (!Number.isInteger(season) || (format !== 'CSV' && format !== 'XLSX')) fail(400, 'request.invalid');
    return finance.exportJournal(season, format as ExportFormat);
  })
  .on('GET', '/api/v1/finance/bookings/:id', (req) => (reader(req), finance.get(req.params.id)))
  .on('PUT', '/api/v1/finance/bookings/:id', (req) => finance.update(reader(req, 'WRITE'), req.params.id, req.body ?? {}))
  .on('DELETE', '/api/v1/finance/bookings/:id', (req) => (reader(req, 'WRITE'), finance.delete(req.params.id)))
  .on('POST', '/api/v1/finance/transfers', (req) => finance.transfer(reader(req, 'WRITE'), req.body ?? {}))
  .on('POST', '/api/v1/finance/bookings/:id/reverse', (req) => finance.reverse(reader(req, 'WRITE'), req.params.id))
  .on('POST', '/api/v1/finance/bookings/:id/receipts', (req) => finance.addReceipt(reader(req, 'WRITE'), req.params.id, req.body))
  .on(
    'DELETE',
    '/api/v1/finance/bookings/:id/receipts/:fileId',
    (req) => (reader(req, 'WRITE'), finance.removeReceipt(req.params.id, req.params.fileId)),
  )
  .on('GET', '/api/v1/finance/bookings/:id/receipts/:fileId/link', (req) => (reader(req), finance.receiptLink(req.params.id, req.params.fileId)))
  .on('GET', '/api/v1/finance/audits', (req) => finance.auditList(reader(req)))
  .on('POST', '/api/v1/finance/audits', (req) => finance.confirmAudit(reader(req), req.body ?? {}))
  .on('GET', '/api/v1/finance/audits/:id', (req) => finance.audit(directory.actor(req), req.params.id))
  .on('GET', '/api/v1/finance/budget', (req) => (reader(req), finance.budget(seasonParam(req))))
  .on('PUT', '/api/v1/finance/budget', (req) => (reader(req, 'WRITE'), finance.saveBudget(seasonParam(req), req.body ?? {})))
  .on('GET', '/api/v1/finance/invoices', (req) => (reader(req), finance.invoiceList()))
  .on('POST', '/api/v1/finance/invoices', (req) => finance.saveInvoice(reader(req, 'WRITE'), null, req.body ?? {}))
  .on('GET', '/api/v1/finance/invoices/:id', (req) => (reader(req), finance.invoice(req.params.id)))
  .on('PUT', '/api/v1/finance/invoices/:id', (req) => finance.saveInvoice(reader(req, 'WRITE'), req.params.id, req.body ?? {}))
  .on('DELETE', '/api/v1/finance/invoices/:id', (req) => finance.deleteInvoice(reader(req, 'WRITE'), req.params.id))
  .on('POST', '/api/v1/finance/invoices/:id/pay', (req) => finance.payInvoice(reader(req, 'WRITE'), req.params.id, req.body ?? {}))
  .on('GET', '/api/v1/finance/fees/settings', (req) => (reader(req), { ...finance.feeSettings.data }))
  .on('PUT', '/api/v1/finance/fees/settings', (req) => (reader(req, 'WRITE'), finance.saveFeeSettings(req.body ?? {})))
  .on('GET', '/api/v1/finance/fees/rates', (req) => (reader(req), finance.rates(seasonParam(req))))
  .on('PUT', '/api/v1/finance/fees/rates', (req) => (reader(req, 'WRITE'), finance.saveRates(seasonParam(req), req.body ?? {})))
  .on('GET', '/api/v1/finance/fees/charges', (req) => (reader(req), finance.chargeList(seasonParam(req))))
  .on('POST', '/api/v1/finance/fees/charges/generate', (req) => (reader(req, 'WRITE'), finance.generate(seasonParam(req))))
  .on('GET', '/api/v1/finance/fees/charges/:id', (req) => (reader(req), finance.charge(req.params.id)))
  .on('PUT', '/api/v1/finance/fees/charges/:id', (req) => (reader(req, 'WRITE'), finance.adjustCharge(req.params.id, req.body ?? {})))
  .on('DELETE', '/api/v1/finance/fees/charges/:id', (req) => (reader(req, 'WRITE'), finance.deleteCharge(req.params.id)))
  .on('POST', '/api/v1/finance/fees/charges/:id/reminder', (req) => (reader(req, 'WRITE'), finance.remindCharge(req.params.id)))
  .on('POST', '/api/v1/finance/fees/charges/:id/payments', (req) => finance.payCharge(reader(req, 'WRITE'), req.params.id, req.body ?? {}))
  .on('GET', '/api/v1/me/fees', (req) => finance.myFees(directory.actor(req)))
  .on('GET', '/api/v1/finance/fees/members/:memberId', (req) => (reader(req), finance.chargesOf([req.params.memberId])))
  .on('GET', '/api/v1/finance/audits/:id/report/link', (req) => finance.auditReportLink(directory.actor(req), req.params.id));

// server: JdbcFinanceRepository.personalData
personalData.set('finance', (memberId) => {
  const charges = finance.charges.data.filter((c) => c.memberId === memberId);
  return {
    fee_charges: charges.map((c) => ({
      season: c.season,
      kind: c.kind,
      amount_cents: c.amountCents,
      waived: c.waived,
      due_on: c.dueOn,
      note: c.note,
    })),
    fee_payments: charges.flatMap((c) =>
      finance.charge(c.id).payments.map((p) => ({ season: c.season, booked_on: p.paidOn, amount_cents: p.amountCents })),
    ),
  };
});

/** server: BankQr.iban (ISO 13616 mod 97). */
function ibanValid(iban: string): boolean {
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const digits = [...(iban.slice(4) + iban.slice(0, 4))].map((ch) => parseInt(ch, 36)).join('');
  return [...digits].reduce((rest, d) => (rest * 10 + Number(d)) % 97, 0) === 1;
}
