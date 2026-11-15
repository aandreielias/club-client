import { background } from '../state/background';
import type { DetailController } from './DetailController.svelte';

interface Store<T> {
  get(key: string): T | undefined;
  load(): Promise<unknown>;
  deletedHere?(key: string): boolean;
}

/**
 * A record view over a club store (types, kinds): the record by key, reloaded on open; the view closes with a note when it was
 * deleted elsewhere, quietly after its own delete. Create during component initialisation.
 */
export class StoredRecord<T> {
  #loaded = $state(false);
  readonly record: T | undefined;

  constructor(
    private readonly view: DetailController,
    private readonly store: Store<T>,
    key: () => string,
    gone: string,
    busy: () => boolean,
  ) {
    this.record = $derived(store.get(key()));
    // A failed load is no proof the record is gone: the view then keeps showing what the store already holds.
    background(store.load().then(() => (this.#loaded = true)));
    $effect(() => {
      if (this.#loaded && !this.record && !busy()) {
        if (!store.deletedHere?.(key())) view.notify(gone);
        view.leave();
      }
    });
  }

  /** Saves through `write`, then reloads the store. */
  async saved(write: () => Promise<unknown>): Promise<void> {
    await write();
    await this.store.load();
  }
}
