import type { MailApi } from './MailApi';
import type { MailboxAdmin } from './model';

/** Every club mailbox for admin and board (Einstellungen › Postfächer and its windows); loaded when they open one. */
export class MailboxesStore {
  items = $state.raw<readonly MailboxAdmin[]>([]);

  constructor(private readonly api: MailApi) {}

  async load(): Promise<readonly MailboxAdmin[]> {
    this.items = await this.api.allMailboxes();
    return this.items;
  }

  get(id: string): MailboxAdmin | undefined {
    return this.items.find((m) => m.id === id);
  }
}
