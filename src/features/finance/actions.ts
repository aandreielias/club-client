import { attempt, confirmed, inWindow, type RecordActionProvider } from '../../lib/actions/RecordActions';
import { catalogActions } from '../../lib/actions/catalogActions';
import { bus } from '../../lib/container';
import { downloadLink } from '../../lib/window/openTab';
import { WINDOW_OPEN } from '../../lib/window/WindowService.svelte';
import { isFixed, type Account, type Audit, type Booking, type Category, type Charge, type Invoice } from './model';
import { accounts, categories, financeApi, financeMay, money } from './services';

const writer = () => financeMay('WRITE');

export const accountActions: RecordActionProvider<Account> = catalogActions(bus, 'finance-account', 'Konto', accounts, writer);
export const categoryActions: RecordActionProvider<Category> = catalogActions(bus, 'finance-category', 'Kategorie', categories, writer);

const transfer = (b: Booking) => (b.transferId ? ' Bei einer Umbuchung beide Konten.' : '');

/** A booking: edit and delete until a Storno or a Kassenprüfung covers it; Storno opens the counter-booking. */
export const bookingActions: RecordActionProvider<Booking> = {
  load: (id) => financeApi.booking(id),
  actions: (b) =>
    writer()
      ? [
          ...(!isFixed(b) && !b.locked ? [inWindow(bus, 'booking', b.id, 'record.edit', { icon: 'edit', group: 'edit' })] : []),
          ...(!b.reversesId && !b.reversedBy
            ? [
                {
                  command: 'booking.reverse' as const,
                  label: 'Stornieren',
                  icon: 'undo' as const,
                  group: 'edit',
                  run: () =>
                    confirmed(
                      bus,
                      {
                        title: 'Buchung stornieren',
                        message: `Eine Gegenbuchung über ${money(-b.amountCents)} mit heutigem Datum hebt „${b.text}“ auf.${transfer(b)}`,
                        confirmLabel: 'Stornieren',
                        danger: true,
                      },
                      async () => bus.publish(WINDOW_OPEN, { kind: 'booking', id: (await financeApi.reverse(b.id)).id }),
                      'Buchung storniert.',
                    ),
                },
              ]
            : []),
          ...(!b.reversedBy && !b.locked
            ? [
                {
                  command: 'record.delete' as const,
                  icon: 'delete' as const,
                  danger: true,
                  group: 'edit',
                  leaves: true,
                  run: () =>
                    confirmed(
                      bus,
                      {
                        title: 'Buchung löschen',
                        message: `„${b.text}“ und ihre Belege werden gelöscht.${transfer(b)}`,
                        confirmLabel: 'Löschen',
                        danger: true,
                      },
                      () => financeApi.delete(b.id),
                      'Buchung gelöscht.',
                    ),
                },
              ]
            : []),
        ]
      : [],
};

/** An open invoice: pay (books it, finishes its task), edit, delete; nothing once paid. */
export const invoiceActions: RecordActionProvider<Invoice> = {
  load: (id) => financeApi.invoice(id),
  actions: (i) =>
    writer() && !i.bookingId
      ? [
          inWindow(bus, 'invoice', i.id, 'invoice.pay', { label: 'Bezahlt' }),
          inWindow(bus, 'invoice', i.id, 'record.edit', { icon: 'edit', group: 'edit' }),
          {
            command: 'record.delete',
            icon: 'delete',
            danger: true,
            group: 'edit',
            leaves: true,
            run: () =>
              confirmed(
                bus,
                { title: 'Rechnung löschen', message: `„${i.text}“ und ihre Aufgabe werden gelöscht.`, confirmLabel: 'Löschen', danger: true },
                () => financeApi.deleteInvoice(i.id),
                'Rechnung gelöscht.',
              ),
          },
        ]
      : [],
};

/** A member's fee: pay and remind while open, adjust, delete while unpaid. */
export const chargeActions: RecordActionProvider<Charge> = {
  load: (id) => financeApi.charge(id),
  actions: (c) => {
    if (!writer()) return [];
    const open = c.status === 'OPEN' || c.status === 'PARTIAL';
    return [
      ...(open
        ? [
            inWindow(bus, 'fee-charge', c.id, 'fee.pay', { label: 'Zahlung' }),
            {
              command: 'fee.remind' as const,
              label: 'Erinnern',
              run: () => attempt(bus, () => financeApi.remindCharge(c.id), 'Erinnerung gesendet.'),
            },
          ]
        : []),
      inWindow(bus, 'fee-charge', c.id, 'record.edit', { label: 'Anpassen', icon: 'edit', group: 'edit' }),
      ...(c.payments.length
        ? []
        : [
            {
              command: 'record.delete' as const,
              icon: 'delete' as const,
              danger: true,
              group: 'edit',
              leaves: true,
              run: () =>
                confirmed(
                  bus,
                  {
                    title: 'Beitrag löschen',
                    message: `Der Beitrag von ${money(c.amountCents)} wird gelöscht.`,
                    confirmLabel: 'Löschen',
                    danger: true,
                  },
                  () => financeApi.deleteCharge(c.id),
                  'Beitrag gelöscht.',
                ),
            },
          ]),
    ];
  },
};

/** A Kassenprüfung: its report as Word document. */
export const auditActions: RecordActionProvider<Audit> = {
  load: (id) => financeApi.audit(id),
  actions: (a) =>
    a.reportId
      ? [
          {
            command: 'record.download',
            label: 'Bericht herunterladen',
            icon: 'download',
            run: () =>
              attempt(bus, () =>
                downloadLink(
                  financeApi.auditReportLink(a.id).then((l) => l.url),
                  `${a.title}.docx`,
                ),
              ),
          },
        ]
      : [],
};
