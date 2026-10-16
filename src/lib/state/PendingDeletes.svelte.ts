import { SvelteSet } from 'svelte/reactivity';
import type { EventBus } from '../bus';
import { APP_ERROR } from '../errors/ErrorReporter';
import { TOAST } from '../notify/ToastService.svelte';

export interface PendingDelete {
  /** Record id; lists hide rows with this key while the delete is pending. */
  id: string;
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
    this.#hidden.add(entry.id);
    this.#pending.set(entry.id, { entry, timer: setTimeout(() => void this.commit(entry.id), this.undoMs) });
    this.bus.publish(TOAST, { text: entry.text, durationMs: this.undoMs, action: { label: 'Rückgängig', run: () => this.undo(entry.id) } });
  }

  undo(id: string): void {
    const pending = this.#pending.get(id);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.#pending.delete(id);
    this.#hidden.delete(id);
    this.bus.publish(TOAST, { text: 'Wiederhergestellt.' });
  }

  /** Runs every pending delete now (e.g. the page is about to unload). */
  flush(): void {
    for (const id of [...this.#pending.keys()]) void this.commit(id);
  }

  private async commit(id: string): Promise<void> {
    const pending = this.#pending.get(id);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.#pending.delete(id);
    try {
      await pending.entry.commit();
    } catch (error) {
      // The record still exists: show it again and say why.
      this.#hidden.delete(id);
      this.bus.publish(APP_ERROR, error);
    }
  }
}
