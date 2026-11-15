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
    booking: { component: BookingView, page: (id) => `/finance/${encodeURIComponent(id)}`, canOpen: reads },
    'booking-new': { component: BookingCreateView, canOpen: writes },
    'finance-account': { component: AccountView, canOpen: reads },
    'finance-account-new': { component: AccountView, canOpen: writes },
    'finance-category': { component: CategoryView, canOpen: reads },
    'finance-category-new': { component: CategoryView, canOpen: writes },
    audit: { component: AuditView, canOpen: reads },
    invoice: { component: InvoiceView, canOpen: reads },
    'invoice-new': { component: InvoiceView, canOpen: writes },
    'fee-charge': { component: ChargeView, canOpen: reads },
    'finance-section': { component: FinanceSectionView, canOpen: reads },
    // The server decides who confirms (auditors and admins); READ to open the form.
    'audit-new': { component: AuditView, canOpen: reads },
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
