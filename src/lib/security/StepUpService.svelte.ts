import type { TotpEnrollment } from '../auth/AuthProvider';

/** Club PIN (coaches), a code of the own authenticator app (admin, board), or setting the app up first. */
export type StepUpMode = 'pin' | 'totp' | 'enroll';

export interface StepUpMethods {
  /** Admin and board confirm with their authenticator app instead of the club PIN. */
  usesTotp(): boolean;
  verifyPin(pin: string): Promise<unknown>;
  totpFactor(): Promise<string | null>;
  enrollTotp(): Promise<TotpEnrollment>;
  verifyTotp(factorId: string, code: string): Promise<void>;
  /** Tells the server about the fresh authenticator-app check in the token. */
  confirmTotp(): Promise<unknown>;
}

/**
 * Coordinates the step-up confirmation. Requests that need it wait on one shared prompt;
 * the StepUpDialog renders while `open` and calls `confirm` or `cancel`.
 */
export class StepUpService {
  open = $state(false);
  /** null while the dialog finds out which confirmation applies. */
  mode = $state<StepUpMode | null>(null);
  enrollment = $state<TotpEnrollment | null>(null);
  /** Finding out the mode failed (e.g. the login service is unreachable). */
  failure = $state<unknown>(null);
  /** Counts cancelled prompts, so views waiting for the confirmation can react (e.g. a window closes). */
  cancelled = $state(0);

  #pending: Promise<boolean> | null = null;
  #resolve: (ok: boolean) => void = () => {};
  #factorId: string | null = null;

  constructor(private readonly methods: StepUpMethods) {}

  /** Resolves true after a successful step-up, false when the user cancels. */
  request(): Promise<boolean> {
    this.#pending ??= new Promise<boolean>((resolve) => {
      this.#resolve = resolve;
      this.open = true;
      void this.#prepare();
    });
    return this.#pending;
  }

  /** Verifies the PIN or code; rejects (dialog stays open) when it is wrong. */
  async confirm(secret: string): Promise<void> {
    if (this.mode === 'pin') {
      await this.methods.verifyPin(secret);
    } else {
      const factorId = this.enrollment?.factorId ?? this.#factorId;
      if (!factorId) throw new Error('Die Authenticator-App ist nicht eingerichtet.');
      await this.methods.verifyTotp(factorId, secret);
      await this.methods.confirmTotp();
    }
    this.settle(true);
  }

  cancel(): void {
    this.cancelled++;
    this.settle(false);
  }

  async #prepare(): Promise<void> {
    this.mode = null;
    this.enrollment = null;
    this.failure = null;
    if (!this.methods.usesTotp()) {
      this.mode = 'pin';
      return;
    }
    try {
      this.#factorId = await this.methods.totpFactor();
      if (!this.#factorId) this.enrollment = await this.methods.enrollTotp();
      this.mode = this.#factorId ? 'totp' : 'enroll';
    } catch (error) {
      this.failure = error;
    }
  }

  private settle(ok: boolean): void {
    this.open = false;
    this.#pending = null;
    this.#resolve(ok);
  }
}
