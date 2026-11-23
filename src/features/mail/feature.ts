import { lazy } from '../../ui/lazy';
import { mailActions, mailboxActions } from './actions';
import { ADMIN_BOARD } from '../../lib/types';
import { detailRoute, type Feature } from '../Feature';
import { MAIL_MESSAGES } from './messages';
import { mailCenter } from './services';

const MailboxCreateView = lazy(() => import('./MailboxCreateView.svelte'));
const MailboxView = lazy(() => import('./MailboxView.svelte'));
const MailComposeView = lazy(() => import('./MailComposeView.svelte'));
const MailPage = lazy(() => import('./MailPage.svelte'));
const MailSignatureView = lazy(() => import('./MailSignatureView.svelte'));
const RecordCodePage = lazy(() => import('./RecordCodePage.svelte'));
const MailView = lazy(() => import('./MailView.svelte'));

export const mailFeature: Feature = {
  id: 'mail',
  routes: [
    // server: MailHandlers - the own mailbox and the shared ones of the member's roles.
    { path: '/mail', component: MailPage, nav: 'E-Mail', icon: 'mail', badge: () => mailCenter.unread },
    detailRoute('/mailboxes/:id', MailboxView, { href: '/settings/mailboxes', label: 'Postfächer' }, { roles: ADMIN_BOARD }),
    // A record linked in a mail, opened from outside (`<website>/app/r/<code>`, see lib/router/DeepLink).
    { path: '/r/:code', component: RecordCodePage },
  ],
  // server: NotificationHandlers.onMailReceived - a new mail's notice opens that mail.
  links: [{ server: '/mail/:mailbox/:mail', to: ({ mailbox, mail }) => ({ window: { kind: 'mail', id: `${mailbox}:${mail}` } }) }],
  actions: { mail: mailActions, mailbox: mailboxActions },
  windows: {
    mail: { label: 'E-Mail', component: MailView },
    'mail-new': { label: 'Neue E-Mail', component: MailComposeView },
    'mail-signature': { label: 'Signatur', component: MailSignatureView },
    // Einstellungen › Postfächer
    mailbox: { label: 'Postfach', component: MailboxView, page: (id) => `/mailboxes/${encodeURIComponent(id)}`, roles: ADMIN_BOARD },
    'mailbox-new': { label: 'Neues Postfach', component: MailboxCreateView, roles: ADMIN_BOARD },
  },
  messages: MAIL_MESSAGES,
  start: (guest) => (guest ? undefined : mailCenter.start()),
};
