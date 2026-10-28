import type { Formatter } from '../../lib/time/Formatter';
import { ListModel } from '../../lib/list/ListModel.svelte';
import type { LocalStore } from '../../lib/storage/LocalStore';
import type { MailApi } from './MailApi';
import type { MailFolder, MailSummary } from './model';

/** One folder of one mailbox, newest first; the page switches `mailboxId` and `folder` and loads again. */
export class MailListModel extends ListModel<MailSummary> {
  mailboxId = $state<string | null>(null);
  folder = $state<MailFolder>('INBOX');

  constructor(api: MailApi, format: () => Formatter, store: LocalStore | null) {
    super(
      {
        id: 'mail',
        load: async () => (this.mailboxId ? api.list(this.mailboxId, this.folder) : []),
        defaultSort: { key: 'sentAt', dir: 'desc' },
        searchText: (m) => `${m.fromName} ${m.from} ${m.subject} ${m.preview}`,
        columns: [
          { key: 'from', label: 'Von', value: (m) => m.fromName || m.from, width: '14rem' },
          { key: 'subject', label: 'Betreff', value: (m) => m.subject },
          { key: 'sentAt', label: 'Datum', value: (m) => m.sentAt, format: (m) => format().dateTime(m.sentAt), width: '11rem' },
        ],
        filters: [{ key: 'unread', label: 'Nur ungelesene', kind: 'toggle', test: (m, on) => !on || !m.read }],
      },
      store,
    );
  }
}
