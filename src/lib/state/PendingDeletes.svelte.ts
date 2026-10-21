import { SvelteSet } from 'svelte/reactivity';
import type { EventBus } from '../bus';
import { APP_ERROR } from '../errors/ErrorReporter';
import { TOAST } from '../notify/ToastService.svelte';

export interface PendingDelete {
  /** Record ids; lists hide rows with these keys while the delete is pending. */
  ids: readonly string[];
  /** Toast text, e.g. "„Ballwagen“ gelöscht." */
  text: string;
  /** The real delete, run when the undo time is over. */
  commit: () => Promise<unknown>;
}

/**
 * Deleting with "Rückgängig" instead of a confirmation: the record disappears at once, a toast offers
 * to undo, and only after the undo time the server deletes it. Lists ask `isHidden` for their rows.
 */
export class PendingDeletes {
  readonly #hidden = new SvelteSet<string>();
  readonly #pending = new Map<string, { entry: PendingDelete; timer: ReturnType<typeof setTimeout> }>();

  constructor(
    private readonly bus: EventBus,
    private readonly undoMs: number,
  ) {}

  isHidden(id: string): boolean {
    return this.#hidden.has(id);
  }

  schedule(entry: PendingDelete): void {
    const key = crypto.randomUUID();
    entry.ids.forEach((id) => this.#hidden.add(id));
    this.#pending.set(key, { entry, timer: setTimeout(() => void this.commit(key), this.undoMs) });
    this.bus.publish(TOAST, { text: entry.text, durationMs: this.undoMs, action: { label: 'Rückgängig', run: () => this.undo(key) } });
  }

  private undo(key: string): void {
    const pending = this.#pending.get(key);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.#pending.delete(key);
    pending.entry.ids.forEach((id) => this.#hidden.delete(id));
    this.bus.publish(TOAST, { text: 'Wiederhergestellt.' });
  }

  /** Runs every pending delete now (the page unloads, or the member logs out while the token is still valid). */
  flush(): Promise<void> {
    return Promise.all([...this.#pending.keys()].map((id) => this.commit(id))).then(() => undefined);
  }

  private async commit(key: string): Promise<void> {
    const pending = this.#pending.get(key);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.#pending.delete(key);
    try {
      await pending.entry.commit();
    } catch (error) {
      // The records still exist: show them again and say why.
      pending.entry.ids.forEach((id) => this.#hidden.delete(id));
      this.bus.publish(APP_ERROR, error);
    }
  }
}
