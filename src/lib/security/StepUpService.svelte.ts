/**
 * Coordinates the PIN confirmation (step-up). Requests that need it wait on one shared prompt;
 * the PinDialog renders while `open` and calls `confirm` or `cancel`.
 */
export class StepUpService {
  open = $state(false);
  /** Counts cancelled prompts, so views waiting for the PIN can react (e.g. a window closes). */
  cancelled = $state(0);

  #pending: Promise<boolean> | null = null;
  #resolve: (ok: boolean) => void = () => {};

  constructor(private readonly verify: (pin: string) => Promise<unknown>) {}

  /** Resolves true after a successful step-up, false when the user cancels. */
  request(): Promise<boolean> {
    this.#pending ??= new Promise<boolean>((resolve) => {
      this.#resolve = resolve;
      this.open = true;
    });
    return this.#pending;
  }

  /** Verifies the PIN with the server; rejects (dialog stays open) when it is wrong. */
  async confirm(pin: string): Promise<void> {
    await this.verify(pin);
    this.settle(true);
  }

  cancel(): void {
    this.cancelled++;
    this.settle(false);
  }

  private settle(ok: boolean): void {
    this.open = false;
    this.#pending = null;
    this.#resolve(ok);
  }
}
