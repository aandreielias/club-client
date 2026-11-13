/**
 * Reactive result of an async read. A `load` while one is running asks for a single trailing reload, so a burst
 * of live events costs two requests, not one each; every `load` resolves once the value reflects that reload,
 * so `await x.load(); x.value` always reads the fresh value. `set` drops an answer still on its way.
 */
export class Resource<T> {
  value = $state.raw<T | undefined>(undefined);
  error = $state.raw<unknown>(null);
  loading = $state(false);

  #sequence = 0;
  #running: Promise<void> | null = null;
  #again = false;

  constructor(private readonly loader: () => Promise<T>) {}

  /** Replaces the value with a fresher one the caller already has (e.g. the answer of a write). */
  set(value: T): void {
    ++this.#sequence;
    this.value = value;
    this.error = null;
    this.loading = false;
  }

  load(): Promise<void> {
    if (this.#running) {
      this.#again = true;
      return this.#running;
    }
    this.#running = (async () => {
      try {
        do {
          this.#again = false;
          await this.#run(++this.#sequence);
        } while (this.#again);
      } finally {
        this.#running = null;
      }
    })();
    return this.#running;
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
