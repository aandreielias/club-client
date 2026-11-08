/**
 * Reactive result of an async read. Only the latest `load` call may write, so a slow earlier
 * request can never overwrite newer data. Every `load` resolves once the latest one has settled,
 * so `await x.load(); x.value` always reads the fresh value.
 */
export class Resource<T> {
  value = $state.raw<T | undefined>(undefined);
  error = $state.raw<unknown>(null);
  loading = $state(false);

  #sequence = 0;
  #latest: Promise<void> = Promise.resolve();

  constructor(private readonly loader: () => Promise<T>) {}

  /** Replaces the value with a fresher one the caller already has (e.g. the answer of a write). */
  set(value: T): void {
    ++this.#sequence;
    this.value = value;
    this.error = null;
    this.loading = false;
  }

  async load(): Promise<void> {
    let current = this.#run(++this.#sequence);
    this.#latest = current;
    await current;
    // A newer load started meanwhile: wait for it instead of returning before the value is set.
    while (this.#latest !== current) await (current = this.#latest);
  }

  async #run(sequence: number): Promise<void> {
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
