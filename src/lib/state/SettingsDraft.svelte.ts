import { Action } from './Action.svelte';

/**
 * Club-wide values edited on a settings page (SettingsForm): a working copy, whether it differs from what was saved, discarding it,
 * and saving it with one Action. Lists of records use windows instead.
 */
export class SettingsDraft<T> {
  value = $state<T>() as T;
  readonly save = new Action();
  #saved = $state('');

  constructor(initial: T) {
    this.load(initial);
  }

  /** Something changed since loading or saving. */
  get dirty(): boolean {
    return JSON.stringify(this.value) !== this.#saved;
  }

  /** Takes the server's values (after loading or saving). */
  load(value: T): void {
    this.value = structuredClone(value);
    this.#saved = JSON.stringify(value);
  }

  /** Back to the saved values. */
  reset(): void {
    this.value = JSON.parse(this.#saved) as T;
    this.save.reset();
  }

  /** Saves the working copy; the answer becomes the new saved state. */
  async commit(write: (value: T) => Promise<T>): Promise<boolean> {
    const draft = $state.snapshot(this.value) as T;
    let saved: T | undefined;
    if (!(await this.save.run(async () => (saved = await write(draft))))) return false;
    this.load(saved!);
    return true;
  }
}
