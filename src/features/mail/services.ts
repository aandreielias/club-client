import { api, bus } from '../../lib/container';
import { MailApi } from './MailApi';
import { MailboxesStore } from './MailboxesStore.svelte';
import { MailCenter } from './MailCenter.svelte';

/** Mail services, created once; the center lives for the whole signed-in session. */
export const mailApi = new MailApi(api);
export const mailCenter = new MailCenter(mailApi, bus);
export const mailboxes = new MailboxesStore(mailApi);
