/**
 * Reactive result of an async read. Only the latest `load` call may write, so a slow earlier
 * request can never overwrite newer data.
 */
export class Resource<T> {
  value = $state.raw<T | undefined>(undefined);
  error = $state.raw<unknown>(null);
  loading = $state(false);

  #sequence = 0;

  constructor(private readonly loader: () => Promise<T>) {}

  /** Replaces the value with a fresher one the caller already has (e.g. the answer of a write). */
  set(value: T): void {
    ++this.#sequence;
    this.value = value;
    this.error = null;
    this.loading = false;
  }

  async load(): Promise<void> {
    const sequence = ++this.#sequence;
    this.loading = true;
    this.error = null;
    try {
      const value = await this.loader();
      if (sequence === this.#sequence) this.value = value;
    } catch (error) {
      if (sequence === this.#sequence) this.error = error;
    } finally {
      if (sequence === this.#sequence) this.loading = false;
    }
  }
}
