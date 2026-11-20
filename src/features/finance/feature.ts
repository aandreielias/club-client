import { session } from '../../lib/container';
import { reaches } from './model';
import { detailRoute, type Feature } from '../Feature';
import { accountActions, auditActions, bookingActions, categoryActions, chargeActions, invoiceActions } from './actions';
import AccountView from './AccountView.svelte';
import AuditView from './AuditView.svelte';
import BookingCreateView from './BookingCreateView.svelte';
import BookingView from './BookingView.svelte';
import CategoryView from './CategoryView.svelte';
import ChargeView from './ChargeView.svelte';
import FinancePage from './FinancePage.svelte';
import FinanceSectionView from './FinanceSectionView.svelte';
import InvoiceView from './InvoiceView.svelte';
import { FINANCE_MESSAGES } from './messages';
import MyFeesSection from './MyFeesSection.svelte';

// server: FinanceAccess.level - offices with a Buchhaltung level, admins and the board; WRITE to book.
const reads = () => reaches(session.me?.financeAccess, 'READ');
const writes = () => reaches(session.me?.financeAccess, 'WRITE');

export const financeFeature: Feature = {
  id: 'finance',
  routes: [
    { path: '/finance', component: FinancePage, nav: 'Buchhaltung', icon: 'finance', visible: reads },
    detailRoute('/finance/:id', BookingView, { href: '/finance', label: 'Buchhaltung' }, { visible: reads }),
  ],
  windows: {
    booking: { label: 'Buchung', component: BookingView, page: (id) => `/finance/${encodeURIComponent(id)}`, canOpen: reads },
    'booking-new': { label: 'Neue Buchung', component: BookingCreateView, canOpen: writes },
    'finance-account': { label: 'Konto', component: AccountView, canOpen: reads },
    'finance-account-new': { label: 'Neues Konto', component: AccountView, canOpen: writes },
    'finance-category': { label: 'Kategorie', component: CategoryView, canOpen: reads },
    'finance-category-new': { label: 'Neue Kategorie', component: CategoryView, canOpen: writes },
    audit: { label: 'Kassenprüfung', component: AuditView, canOpen: reads },
    invoice: { label: 'Rechnung', component: InvoiceView, canOpen: reads },
    'invoice-new': { label: 'Neue Rechnung', component: InvoiceView, canOpen: writes },
    'fee-charge': { label: 'Mitgliedsbeitrag', component: ChargeView, canOpen: reads },
    'finance-section': { label: 'Buchhaltung', component: FinanceSectionView, canOpen: reads },
    // The server decides who confirms (auditors and admins); READ to open the form.
    'audit-new': { label: 'Neue Kassenprüfung', component: AuditView, canOpen: reads },
  },
  actions: {
    booking: bookingActions,
    'finance-account': accountActions,
    'finance-category': categoryActions,
    audit: auditActions,
    invoice: invoiceActions,
    'fee-charge': chargeActions,
  },
  messages: FINANCE_MESSAGES,
  // Shown only while the member or a ward has fees.
  home: { id: 'fees', label: 'Meine Beiträge', component: MyFeesSection, defaultShown: true },
};
