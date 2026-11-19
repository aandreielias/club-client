import { describe, expect, it } from 'vitest';
import { directory } from '../../lib/mock/core';
import { mockServer } from '../../lib/mock/MockServer';
import type { Member } from '../../lib/types';
import { BookingForm } from './BookingForm.svelte';
import { finance } from './mock';
import { tasks } from '../tasks/mock';
import { yearLabel, yearOf } from '../../lib/time/clubYear';
import { parseMoney } from './model';

const member = (id: string): Member => directory.members.data.find((m) => m.id === id)!;
const code = (c: string) => expect.objectContaining({ code: c });
const balance = (key: string) => finance.accountList().find((a) => a.key === key)!.balanceCents;
const booking = (category: string, amountCents: number) => ({
  bookedOn: '2026-09-15',
  account: 'BANK',
  category,
  amountCents,
  text: 'Test',
  note: null,
  refs: [],
});

describe('finance model', () => {
  it('reads amounts as typed in German or plain', () => {
    expect(parseMoney('12,50')).toBe(1250);
    expect(parseMoney('1.200,5')).toBe(120_050);
    expect(parseMoney('12.5')).toBe(1250);
    expect(parseMoney(' 7 ')).toBe(700);
    expect(parseMoney('1,234')).toBeNull();
    expect(parseMoney('-3')).toBeNull();
    expect(parseMoney('')).toBeNull();
  });

  it('names the season by its first year', () => {
    expect(yearOf('2026-06-30', 7)).toBe(2025);
    expect(yearOf('2026-07-01', 7)).toBe(2026);
    expect(yearLabel(2026, 7)).toBe('2026/27');
    expect(yearLabel(2026, 1)).toBe('2026');
  });

  it('signs the amount by the category', () => {
    const form = BookingForm.blank(false, '2026-09-15', (key) => (key === 'HALL' ? 'OUT' : 'IN'));
    form.account = 'BANK';
    form.category = 'HALL';
    form.amount = '85,00';
    form.text = 'Halle';
    expect(form.valid).toBe(true);
    expect(form.toInput().amountCents).toBe(-8500);
    form.category = 'FEES';
    expect(form.toInput().amountCents).toBe(8500);
    form.amount = '0';
    expect(form.errors.amount).toBeTruthy();
  });
});

describe('mock finance', () => {
  it('lets only finance levels read and only WRITE book', () => {
    const read = (id: string) => mockServer.handle('GET', '/api/v1/finance/accounts', null, member(id).email);
    expect(() => read('spielerin')).toThrow(code('finance.forbidden'));
    expect(read('pruefer')).toBeTruthy();
    expect(() => finance.require(member('pruefer'), 'WRITE')).toThrow(code('finance.forbidden'));
    expect(finance.require(member('kassier'), 'WRITE')).toBeTruthy();
  });

  it('books, transfers and reverses like the server', () => {
    const kassier = member('kassier');
    const bank = balance('BANK');
    const cash = balance('CASH');
    expect(() => finance.create(kassier, booking('HALL', 100))).toThrow(code('finance.direction-mismatch'));
    const fee = finance.create(kassier, booking('FEES', 5000));
    finance.transfer(kassier, { bookedOn: '2026-09-16', from: 'BANK', to: 'CASH', amountCents: 2000, text: 'Bargeld' });
    expect(balance('BANK')).toBe(bank + 3000);
    expect(balance('CASH')).toBe(cash + 2000);

    const storno = finance.reverse(kassier, fee.id);
    expect(storno).toMatchObject({ amountCents: -5000, reversesId: fee.id });
    expect(() => finance.reverse(kassier, fee.id)).toThrow(code('finance.already-reversed'));
    expect(() => finance.update(kassier, fee.id, booking('FEES', 6000))).toThrow(code('finance.booking-fixed'));
    expect(() => finance.delete(fee.id)).toThrow(code('finance.booking-fixed'));
    finance.delete(storno.id);
    expect(finance.update(kassier, fee.id, booking('FEES', 6000)).amountCents).toBe(6000);
    expect(() => finance.deleteCategory('FEES')).toThrow(code('finance-category.in-use'));
    expect(() => finance.saveCategory('FEES', { label: 'Beiträge', direction: 'OUT', sort: 0, archived: false })).toThrow(
      code('finance-category.in-use'),
    );
  });

  it('locks what a Kassenprüfung checked; only a Storno corrects it', async () => {
    const kassier = member('kassier');
    const fee = finance.create(kassier, booking('FEES', 5000));
    const until = { checkedUntil: '2026-09-30', note: 'In Ordnung.' };
    await expect(finance.confirmAudit(kassier, until)).rejects.toThrow(code('finance.forbidden'));
    await expect(finance.confirmAudit(member('pruefer'), { checkedUntil: '2999-01-01' })).rejects.toThrow(code('finance.audit-date-invalid'));
    const audit = await finance.confirmAudit(member('pruefer'), until);
    expect(audit.title).toBe('Kassenprüfung bis 30.09.2026');
    await expect(finance.confirmAudit(member('admin'), until)).rejects.toThrow(code('finance.audit-date-invalid'));
    expect(finance.get(fee.id).locked).toBe(true);
    expect(() => finance.update(kassier, fee.id, booking('FEES', 6000))).toThrow(code('finance.period-checked'));
    expect(() => finance.delete(fee.id)).toThrow(code('finance.period-checked'));
    expect(finance.reverse(kassier, fee.id).locked).toBe(false);

    const csv = await (await finance.exportJournal(2026, 'CSV')).text();
    expect(csv).toContain('Datum;Konto');
  });

  it('plans a budget against what is booked', () => {
    const kassier = member('kassier');
    const actual = () => finance.budget(2026).items.find((l) => l.category === 'TRAVEL')?.actualCents ?? 0;
    const before = actual();
    expect(() => finance.saveBudget(2026, { items: [{ category: 'TRAVEL', plannedCents: -1 }] })).toThrow(code('finance.budget-invalid'));
    expect(() =>
      finance.saveBudget(2026, {
        items: [
          { category: 'TRAVEL', plannedCents: 1 },
          { category: 'TRAVEL', plannedCents: 2 },
        ],
      }),
    ).toThrow(code('finance.budget-invalid'));
    finance.create(kassier, { ...booking('TRAVEL', -3000), bookedOn: '2026-10-15' });
    const saved = finance.saveBudget(2026, {
      items: [
        { category: 'TRAVEL', plannedCents: 10_000 },
        { category: 'GRANTS', plannedCents: 0 },
      ],
    });
    expect(saved.items.find((l) => l.category === 'TRAVEL')).toEqual({ category: 'TRAVEL', plannedCents: 10_000, actualCents: before + 3000 });
    expect(saved.items.some((l) => l.category === 'GRANTS')).toBe(false);
    expect(finance.budget(2025).items.some((l) => l.category === 'TRAVEL')).toBe(false);
  });

  it('makes an invoice a task until it is paid', () => {
    const kassier = member('kassier');
    const input = { counterparty: 'Stadt', text: 'Hallenmiete Oktober', amountCents: 45_000, dueOn: '2026-11-30', category: 'HALL', note: null };
    expect(() => finance.saveInvoice(kassier, null, { ...input, counterparty: ' ' })).toThrow(code('finance.invoice-invalid'));
    const invoice = finance.saveInvoice(kassier, null, input);
    expect(invoice.taskId).toBeTruthy();
    const task = () => tasks.tasks.data.find((t) => t.id === invoice.taskId)!;
    expect(task()).toMatchObject({ status: 'OPEN', title: 'Rechnung bezahlen: Stadt – Hallenmiete Oktober' });
    finance.saveInvoice(kassier, invoice.id, { ...input, dueOn: '2026-12-15' });
    expect(task().dueAt?.startsWith('2026-12-15')).toBe(true);
    expect(finance.searchInvoices(kassier, 'hallenmiete okt', 5).map((i) => i.id)).toContain(invoice.id);
    expect(() => finance.deleteCategory('HALL')).toThrow(code('finance-category.in-use'));

    const bank = balance('BANK');
    const paid = finance.payInvoice(kassier, invoice.id, { account: 'BANK', paidOn: null });
    expect(balance('BANK')).toBe(bank - 45_000);
    expect(task().status).toBe('DONE');
    expect(() => finance.payInvoice(kassier, invoice.id, { account: 'BANK' })).toThrow(code('finance.invoice-paid'));
    expect(() => finance.deleteInvoice(kassier, invoice.id)).toThrow(code('finance.invoice-paid'));
    expect(() => finance.delete(paid.bookingId!)).toThrow(code('data.conflict'));

    const other = finance.saveInvoice(kassier, null, { ...input, category: 'FEES', text: 'Beitrag' });
    finance.deleteInvoice(kassier, other.id);
    expect(tasks.tasks.data.some((t) => t.id === other.taskId)).toBe(false);
  });
});

describe('mock finance fees', () => {
  it('charges the rate per kind, the minor rate to minors, and takes payments in parts', () => {
    const kassier = member('kassier');
    const season = 2030;
    const kinds = [...new Set(directory.members.data.flatMap((m) => m.membershipTypes))];
    expect(() => finance.saveRates(season, { items: [{ kind: 'X', cents: -1 }] })).toThrow(code('finance.fee-invalid'));
    finance.saveRates(season, { items: kinds.map((kind) => ({ kind, cents: 10_000, minorCents: 6000 })) });
    const charges = finance.generate(season).items;
    const charged = directory.members.data.filter((m) => m.active && m.membershipTypes.length);
    expect(charges).toHaveLength(charged.length);
    for (const c of charges) expect(c.amountCents).toBe(directory.underAge(c.memberId) ? 6000 : 10_000);
    expect(finance.generate(season).items).toHaveLength(charges.length);

    const c = charges[0];
    expect(() => finance.payCharge(kassier, c.id, { account: 'BANK', amountCents: c.amountCents + 1 })).toThrow(code('finance.payment-too-high'));
    const partial = finance.payCharge(kassier, c.id, { account: 'BANK', amountCents: 1000 });
    expect(partial).toMatchObject({ paidCents: 1000, status: 'PARTIAL' });
    expect(() => finance.deleteCharge(c.id)).toThrow(code('finance.charge-has-payments'));
    expect(() => finance.adjustCharge(c.id, { amountCents: 500, waived: false })).toThrow(code('finance.fee-invalid'));
    expect(finance.adjustCharge(c.id, { amountCents: 1000, waived: false }).status).toBe('PAID');

    finance.reverse(kassier, partial.payments[0].bookingId);
    expect(finance.charge(c.id)).toMatchObject({ paidCents: 0, status: 'OPEN' });
    expect(finance.adjustCharge(c.id, { amountCents: 1000, waived: true, note: 'Härtefall' }).status).toBe('WAIVED');
    expect(finance.myFees(member(c.memberId)).items.map((x) => x.id)).toContain(c.id);
  });
});

describe('mock finance fee rules', () => {
  it('adds up all kinds with SUM and counts the youth age on the cutoff day', () => {
    const season = 2031;
    const kid = directory.members.data.find((m) => m.active && m.membershipTypes.length && directory.underAge(m.id) && m.birthDate)!;
    const saved = structuredClone(kid.membershipTypes);
    kid.membershipTypes = ['HONORARY', 'ORDINARY'];
    const settings = { ...finance.feeSettings.data };
    try {
      expect(() => finance.saveFeeSettings({ ...settings, youthUntilAge: 0 })).toThrow(code('finance.fee-invalid'));
      expect(() => finance.saveFeeSettings({ ...settings, combine: 'MOST' })).toThrow(code('finance.fee-invalid'));
      finance.saveRates(season, {
        items: [
          { kind: 'ORDINARY', cents: 12_000, minorCents: 6000 },
          { kind: 'HONORARY', cents: 1000, minorCents: null },
        ],
      });
      // youth only below 1: everyone pays the full rates, added up
      finance.saveFeeSettings({ ...settings, youthUntilAge: 1, youthCutoff: 'SEASON_START', combine: 'SUM' });
      expect(finance.generate(season).items.find((c) => c.memberId === kid.id)).toMatchObject({
        kinds: ['HONORARY', 'ORDINARY'],
        amountCents: 13_000,
      });
    } finally {
      kid.membershipTypes = saved;
      finance.saveFeeSettings(settings);
    }
  });

  it('lets the club take the books from the board and audits from admins', () => {
    const board = directory.boardSettings.data;
    const vorstand = directory.members.data.find((m) => m.roles.includes('BOARD') && directory.financeLevel(m) === 'READ')!;
    // the seeded admin is also an auditor; an admin holding no office
    const admin = { ...member('admin'), id: 'admin-without-office' };
    expect(finance.mayConfirm(admin)).toBe(true);
    Object.assign(board, { boardFinance: 'NONE', adminsConfirmAudit: false });
    try {
      expect(directory.financeLevel(vorstand)).toBe('NONE');
      expect(finance.mayConfirm(admin)).toBe(false);
    } finally {
      Object.assign(board, { boardFinance: 'READ', adminsConfirmAudit: true });
    }
  });
});

describe('mock finance seeded fees', () => {
  it('shows players and parents their fees with payments', () => {
    const own = finance.myFees(member('spielerin')).items.find((c) => c.id === 'fee-spielerin');
    expect(own).toEqual(
      expect.objectContaining({ memberId: 'spielerin', status: 'PAID', payments: [expect.objectContaining({ amountCents: 12_000 })] }),
    );
    const parent = finance.myFees(member('eltern')).items;
    expect(parent.find((c) => c.id === 'fee-spieler')).toMatchObject({ amountCents: 6000, paidCents: 3000, status: 'PARTIAL' });
    expect(finance.myFees(member('eltern')).instructions).toContain('QR');
    expect(parent.find((c) => c.id === 'fee-spieler')?.bankQr).toMatch(
      /^BCD\n002\n1\nSCT\n\nSV Muster\nAT611904300234573201\nEUR30\.00\n\n\nMitgliedsbeitrag /,
    );
    expect(own?.bankQr).toBeNull();
    const settings = { ...finance.feeSettings.data };
    expect(() => finance.saveFeeSettings({ ...settings, iban: 'AT611904300234573202' })).toThrow(code('finance.bank-invalid'));
    expect(() => finance.saveFeeSettings({ ...settings, holder: null })).toThrow(code('finance.bank-invalid'));
    const ofMember = (id: string) => mockServer.handle('GET', '/api/v1/finance/fees/members/spieler', null, member(id).email);
    expect(() => ofMember('eltern')).toThrow(code('finance.forbidden'));
    expect((ofMember('kassier') as { items: unknown[] }).items).toContainEqual(expect.objectContaining({ id: 'fee-spieler' }));
  });
});
