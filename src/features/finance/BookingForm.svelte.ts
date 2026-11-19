import { RefList } from '../../lib/records/RefList.svelte';
import { FormState } from '../../lib/state/FormState.svelte';
import { settings } from '../../settings';
import { moneyInput, parseMoney, type Booking, type BookingInput, type Direction, type TransferInput } from './model';

export type BookingField = 'bookedOn' | 'account' | 'to' | 'category' | 'amount' | 'text' | 'note' | 'reference' | 'counterparty';

type BookingErrors = Partial<Record<BookingField, string>>;

const limits = settings.finance;

/**
 * A booking or a transfer being entered. The amount is typed without sign; the category's direction gives it (server:
 * Category.requireSign). Validation mirrors the server's Booking.
 */
export class BookingForm extends FormState<BookingErrors> {
  bookedOn = $state('');
  account = $state('');
  /** Transfers: the receiving account. */
  to = $state('');
  category = $state('');
  amount = $state('');
  text = $state('');
  note = $state('');
  reference = $state('');
  counterparty = $state('');
  readonly refs: RefList;
  /** Kostenstelle: at most one record. */
  readonly costCenter: RefList;

  private constructor(
    readonly transfer: boolean,
    private readonly direction: (category: string) => Direction | undefined,
    readonly original: Booking | null = null,
  ) {
    super();
    this.refs = new RefList(limits.maxRefs, original?.refs ?? []);
    this.costCenter = new RefList(1, original?.costCenter ? [original.costCenter] : []);
  }

  static blank(transfer: boolean, today: string, direction: (category: string) => Direction | undefined): BookingForm {
    const form = new BookingForm(transfer, direction);
    form.bookedOn = today;
    return form;
  }

  static edit(booking: Booking, direction: (category: string) => Direction | undefined): BookingForm {
    const form = new BookingForm(false, direction, booking);
    form.bookedOn = booking.bookedOn;
    form.account = booking.account;
    form.category = booking.category ?? '';
    form.amount = moneyInput(booking.amountCents);
    form.text = booking.text;
    form.note = booking.note ?? '';
    form.reference = booking.reference ?? '';
    form.counterparty = booking.counterparty ?? '';
    return form;
  }

  /** Signed by the category: money out is negative. */
  toInput(): BookingInput {
    const cents = parseMoney(this.amount) ?? 0;
    return {
      bookedOn: this.bookedOn,
      account: this.account,
      category: this.category,
      amountCents: this.direction(this.category) === 'OUT' ? -cents : cents,
      text: this.text.trim(),
      note: this.note.trim() || null,
      refs: this.refs.refs.map((r) => ({ kind: r.kind, id: r.id })),
      reference: this.reference.trim() || null,
      counterparty: this.counterparty.trim() || null,
      costCenter: this.costCenter.refs.map((r) => ({ kind: r.kind, id: r.id }))[0] ?? null,
    };
  }

  toTransfer(): TransferInput {
    return {
      bookedOn: this.bookedOn,
      from: this.account,
      to: this.to,
      amountCents: parseMoney(this.amount) ?? 0,
      text: this.text.trim(),
      note: this.note.trim() || null,
    };
  }

  protected validate(): BookingErrors {
    const errors: BookingErrors = {};
    if (!this.bookedOn) errors.bookedOn = 'Datum angeben.';
    if (!this.account) errors.account = 'Konto wählen.';
    if (this.transfer && (!this.to || this.to === this.account)) errors.to = 'Ein anderes Konto wählen.';
    if (!this.transfer && !this.category) errors.category = 'Kategorie wählen.';
    const cents = parseMoney(this.amount);
    if (!cents || cents > limits.maxCents) errors.amount = 'Betrag über 0 angeben, z. B. 12,50.';
    const text = this.text.trim();
    if (!text || text.length > limits.textMaxLength) errors.text = `Text mit 1 bis ${limits.textMaxLength} Zeichen angeben.`;
    if (this.reference.trim().length > limits.referenceMaxLength) errors.reference = `Höchstens ${limits.referenceMaxLength} Zeichen.`;
    if (this.counterparty.trim().length > limits.counterpartyMaxLength) errors.counterparty = `Höchstens ${limits.counterpartyMaxLength} Zeichen.`;
    if (this.note.trim().length > limits.noteMaxLength) errors.note = `Höchstens ${limits.noteMaxLength} Zeichen.`;
    return errors;
  }
}
