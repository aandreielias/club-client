import type { MailApi } from './MailApi';
import type { MailboxAdmin } from './model';

/** Every club mailbox for admin and board (Einstellungen › Postfächer and its windows); loaded when they open one. */
export class MailboxesStore {
  items = $state.raw<readonly MailboxAdmin[]>([]);

  constructor(private readonly api: MailApi) {}

  #sequence = 0;

  /** Only the newest load sets the list: an older answer arriving late never overwrites a newer one. */
  async load(): Promise<readonly MailboxAdmin[]> {
    const sequence = ++this.#sequence;
    const items = await this.api.allMailboxes();
    if (sequence === this.#sequence) this.items = items;
    return items;
  }

  get(id: string): MailboxAdmin | undefined {
    return this.items.find((m) => m.id === id);
  }
}
