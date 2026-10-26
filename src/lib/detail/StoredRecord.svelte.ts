import type { Action } from '../state/Action.svelte';
import type { DetailController } from './DetailController.svelte';

interface Store<T> {
  get(key: string): T | undefined;
  load(): Promise<unknown>;
}

/**
 * A record view over a club store (types, kinds): the record by key, reloaded on open; the view closes with a note when it was
 * deleted elsewhere, quietly after its own delete. Create during component initialisation.
 */
export class StoredRecord<T> {
  #loaded = $state(false);
  #removed = false;
  readonly record: T | undefined;

  constructor(
    private readonly view: DetailController,
    private readonly store: Store<T>,
    key: () => string,
    gone: string,
    busy: () => boolean,
  ) {
    this.record = $derived(store.get(key()));
    void store.load().finally(() => (this.#loaded = true));
    $effect(() => {
      if (this.#loaded && !this.record && !busy()) {
        if (!this.#removed) view.notify(gone);
        view.leave();
      }
    });
  }

  /** Saves through `write`, then reloads the store. */
  async saved(write: () => Promise<unknown>): Promise<void> {
    await write();
    await this.store.load();
  }

  /** Asks, deletes through `remove` with `action`, reloads; the view then closes. */
  remove(label: string, title: string, success: string, action: Action, remove: () => Promise<unknown>): Promise<boolean> {
    return this.view.confirm({ title, message: label, confirmLabel: 'Löschen', danger: true },
      () => this.view.attempt(action, () => action.run(async () => {
        this.#removed = true;
        await remove();
        await this.store.load();
      })), success);
  }
}
