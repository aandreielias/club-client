/** Reactive state of one user-triggered write (busy flag + last error). */
export class Action {
  busy = $state(false);
  error = $state.raw<unknown>(null);

  /** Runs the write; resolves true on success. Errors are kept in `error`, not thrown. */
  async run(write: () => Promise<unknown>): Promise<boolean> {
    if (this.busy) return false;
    this.busy = true;
    this.error = null;
    try {
      await write();
      return true;
    } catch (error) {
      this.error = error;
      return false;
    } finally {
      this.busy = false;
    }
  }

  /** Like run, but resolves the write's result (null when it failed or another write was running). */
  async attempt<T>(write: () => Promise<T>): Promise<T | null> {
    let result: T | null = null;
    await this.run(async () => (result = await write()));
    return result;
  }

  reset(): void {
    this.error = null;
  }
}
