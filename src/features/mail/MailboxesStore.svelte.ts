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

  #deleted = new Set<string>();

  /** Deletes and reloads; open views of it then close without the "gone elsewhere" note. */
  async remove(id: string): Promise<void> {
    await this.api.deleteMailbox(id);
    this.#deleted.add(id);
    await this.load();
  }

  deletedHere(id: string): boolean {
    return this.#deleted.has(id);
  }

  get(id: string): MailboxAdmin | undefined {
    return this.items.find((m) => m.id === id);
  }
}
