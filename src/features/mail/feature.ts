import { ADMIN_BOARD } from '../../lib/types';
import type { Feature } from '../Feature';
import MailboxCreateView from './MailboxCreateView.svelte';
import MailboxPage from './MailboxPage.svelte';
import MailboxView from './MailboxView.svelte';
import MailComposeView from './MailComposeView.svelte';
import MailPage from './MailPage.svelte';
import MailSignatureView from './MailSignatureView.svelte';
import MailView from './MailView.svelte';
import { MAIL_MESSAGES } from './messages';
import { mailCenter } from './services';

export const mailFeature: Feature = {
  id: 'mail',
  routes: [
    // server: MailHandlers - the own mailbox and the shared ones of the member's roles.
    { path: '/mail', component: MailPage, nav: 'E-Mail', icon: 'mail', badge: () => mailCenter.unread },
    { path: '/mailboxes/:id', component: MailboxPage, roles: ADMIN_BOARD },
  ],
  windows: {
    mail: { component: MailView },
    'mail-new': { component: MailComposeView },
    'mail-signature': { component: MailSignatureView },
    // Einstellungen › Postfächer
    mailbox: { component: MailboxView, page: (id) => `/mailboxes/${encodeURIComponent(id)}`, roles: ADMIN_BOARD },
    'mailbox-new': { component: MailboxCreateView, roles: ADMIN_BOARD },
  },
  messages: MAIL_MESSAGES,
  start: () => mailCenter.start(),
};
