import type { DownloadLink } from '../files/model';
import type { ApiClient } from '../../lib/http/ApiClient';
import type {
  Account,
  AccountInput,
  Audit,
  AuditList,
  Booking,
  BookingInput,
  BookingList,
  Category,
  CategoryInput,
  Budget,
  Charge,
  ChargeList,
  ExportFormat,
  FeeRate,
  FeeRates,
  FeeSettings,
  Invoice,
  MyFees,
  InvoiceInput,
  InvoiceList,
  TransferInput,
} from './model';

/** Typed access to the Buchhaltung endpoints of club-server. */
export class FinanceApi {
  static readonly BASE = '/api/v1/finance';

  constructor(private readonly api: ApiClient) {}

  async accounts(): Promise<Account[]> {
    return (await this.api.get<{ items: Account[] }>(`${FinanceApi.BASE}/accounts`)).items;
  }

  /** `key` null = new. */
  saveAccount(key: string | null, input: AccountInput): Promise<Account> {
    return key ? this.api.put<Account>(this.path('accounts', key), input) : this.api.post<Account>(`${FinanceApi.BASE}/accounts`, input);
  }

  deleteAccount(key: string): Promise<void> {
    return this.api.delete(this.path('accounts', key));
  }

  async categories(): Promise<Category[]> {
    return (await this.api.get<{ items: Category[] }>(`${FinanceApi.BASE}/categories`)).items;
  }

  saveCategory(key: string | null, input: CategoryInput): Promise<Category> {
    return key ? this.api.put<Category>(this.path('categories', key), input) : this.api.post<Category>(`${FinanceApi.BASE}/categories`, input);
  }

  deleteCategory(key: string): Promise<void> {
    return this.api.delete(this.path('categories', key));
  }

  /** The season starting in `season`, newest first. */
  bookings(year: number): Promise<BookingList> {
    return this.api.get<BookingList>(`${FinanceApi.BASE}/bookings`, { year });
  }

  booking(id: string): Promise<Booking> {
    return this.api.get<Booking>(this.path('bookings', id));
  }

  create(input: BookingInput): Promise<Booking> {
    return this.api.post<Booking>(`${FinanceApi.BASE}/bookings`, input);
  }

  update(id: string, input: BookingInput): Promise<Booking> {
    return this.api.put<Booking>(this.path('bookings', id), input);
  }

  /** A transfer goes with both legs. */
  delete(id: string): Promise<void> {
    return this.api.delete(this.path('bookings', id));
  }

  /** The outgoing leg. */
  transfer(input: TransferInput): Promise<Booking> {
    return this.api.post<Booking>(`${FinanceApi.BASE}/transfers`, input);
  }

  /** Storno: a booking with the opposite amount, dated today. */
  reverse(id: string): Promise<Booking> {
    return this.api.post<Booking>(`${this.path('bookings', id)}/reverse`, {});
  }

  addReceipt(id: string, file: File): Promise<Booking> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.api.upload<Booking>(`${this.path('bookings', id)}/receipts`, form);
  }

  removeReceipt(id: string, fileId: string): Promise<Booking> {
    return this.api.delete<Booking>(`${this.path('bookings', id)}/receipts/${encodeURIComponent(fileId)}`);
  }

  receiptLink(id: string, fileId: string): Promise<DownloadLink> {
    return this.api.get<DownloadLink>(`${this.path('bookings', id)}/receipts/${encodeURIComponent(fileId)}/link`);
  }

  audits(): Promise<AuditList> {
    return this.api.get<AuditList>(`${FinanceApi.BASE}/audits`);
  }

  audit(id: string): Promise<Audit> {
    return this.api.get<Audit>(this.path('audits', id));
  }

  /** Locks every booking up to `checkedUntil` and stores the report. */
  confirmAudit(checkedUntil: string, note: string | null): Promise<Audit> {
    return this.api.post<Audit>(`${FinanceApi.BASE}/audits`, { checkedUntil, note });
  }

  auditReportLink(id: string): Promise<DownloadLink> {
    return this.api.get<DownloadLink>(`${this.path('audits', id)}/report/link`);
  }

  /** The season's journal as a file (logged as an export). */
  exportJournal(year: number, format: ExportFormat): Promise<Blob> {
    return this.api.get<Blob>(`${FinanceApi.BASE}/bookings/export`, { year, format });
  }

  budget(year: number): Promise<Budget> {
    return this.api.get<Budget>(`${FinanceApi.BASE}/budget`, { year });
  }

  /** Replaces the fiscal year's plan; 0 = nothing planned. */
  saveBudget(year: number, items: { category: string; plannedCents: number }[]): Promise<Budget> {
    return this.api.put<Budget>(`${FinanceApi.BASE}/budget?year=${year}`, { items });
  }

  /** Open ones first (soonest due), then paid ones. */
  invoices(): Promise<InvoiceList> {
    return this.api.get<InvoiceList>(`${FinanceApi.BASE}/invoices`);
  }

  invoice(id: string): Promise<Invoice> {
    return this.api.get<Invoice>(this.path('invoices', id));
  }

  /** `id` null = new: a task for who keeps the books. */
  saveInvoice(id: string | null, input: InvoiceInput): Promise<Invoice> {
    return id ? this.api.put<Invoice>(this.path('invoices', id), input) : this.api.post<Invoice>(`${FinanceApi.BASE}/invoices`, input);
  }

  deleteInvoice(id: string): Promise<void> {
    return this.api.delete(this.path('invoices', id));
  }

  /** Books it on `account` (`paidOn` null = today); its task is done. */
  payInvoice(id: string, account: string, paidOn: string | null): Promise<Invoice> {
    return this.api.post<Invoice>(`${this.path('invoices', id)}/pay`, { account, paidOn });
  }

  feeSettings(): Promise<FeeSettings> {
    return this.api.get<FeeSettings>(`${FinanceApi.BASE}/fees/settings`);
  }

  saveFeeSettings(settings: FeeSettings): Promise<FeeSettings> {
    return this.api.put<FeeSettings>(`${FinanceApi.BASE}/fees/settings`, settings);
  }

  feeRates(season: number): Promise<FeeRates> {
    return this.api.get<FeeRates>(`${FinanceApi.BASE}/fees/rates`, { season });
  }

  /** Replaces the season's rates. */
  saveFeeRates(season: number, items: FeeRate[]): Promise<FeeRates> {
    return this.api.put<FeeRates>(`${FinanceApi.BASE}/fees/rates?season=${season}`, { items });
  }

  charges(season: number): Promise<ChargeList> {
    return this.api.get<ChargeList>(`${FinanceApi.BASE}/fees/charges`, { season });
  }

  /** A charge for every member with a kind that has a rate; existing charges stay. */
  generateCharges(season: number): Promise<ChargeList> {
    return this.api.post<ChargeList>(`${FinanceApi.BASE}/fees/charges/generate?season=${season}`, {});
  }

  charge(id: string): Promise<Charge> {
    return this.api.get<Charge>(this.path('fees/charges', id));
  }

  /** Reduce or waive (`waived`: the rest is forgiven). */
  adjustCharge(id: string, amountCents: number, waived: boolean, note: string | null): Promise<Charge> {
    return this.api.put<Charge>(this.path('fees/charges', id), { amountCents, waived, note });
  }

  deleteCharge(id: string): Promise<void> {
    return this.api.delete(this.path('fees/charges', id));
  }

  /** Books a payment, at most what is open. */
  /** Reminds the member (and guardians) of an open charge now. */
  remindCharge(id: string): Promise<void> {
    return this.api.post(`${this.path('fees/charges', id)}/reminder`);
  }

  payCharge(id: string, account: string, paidOn: string | null, amountCents: number): Promise<Charge> {
    return this.api.post<Charge>(`${this.path('fees/charges', id)}/payments`, { account, paidOn, amountCents });
  }

  /** The member's fees and their wards', with how to pay. */
  myFees(): Promise<MyFees> {
    return this.api.get<MyFees>('/api/v1/me/fees');
  }

  /** One member's fees of every season (READ). */
  async memberCharges(memberId: string): Promise<Charge[]> {
    return (await this.api.get<ChargeList>(this.path('fees/members', memberId))).items;
  }

  private path(kind: string, id: string): string {
    return `${FinanceApi.BASE}/${kind}/${encodeURIComponent(id)}`;
  }
}
