import type { Feature } from '../Feature';
import MailComposeView from './MailComposeView.svelte';
import MailPage from './MailPage.svelte';
import MailView from './MailView.svelte';
import { MAIL_MESSAGES } from './messages';
import { mailCenter } from './services';

export const mailFeature: Feature = {
  id: 'mail',
  routes: [
    // server: MailHandlers - the own mailbox and the shared ones of the member's roles.
    { path: '/mail', component: MailPage, nav: 'E-Mail', icon: 'mail', badge: () => mailCenter.unread },
  ],
  windows: {
    mail: { component: MailView },
    'mail-new': { component: MailComposeView },
  },
  messages: MAIL_MESSAGES,
  start: () => mailCenter.start(),
};
