export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  /** Styles the confirm button as destructive. */
  danger?: boolean;
}

/** Promise-based confirmation dialog (rendered once by the app shell), instead of window.confirm. */
export class ConfirmService {
  current = $state.raw<ConfirmRequest | null>(null);

  #resolve: ((ok: boolean) => void) | null = null;

  /** Resolves true when confirmed, false when cancelled; a new request cancels an open one. */
  ask(request: ConfirmRequest): Promise<boolean> {
    this.#resolve?.(false);
    this.current = request;
    return new Promise((resolve) => (this.#resolve = resolve));
  }

  answer(ok: boolean): void {
    const resolve = this.#resolve;
    this.#resolve = null;
    this.current = null;
    resolve?.(ok);
  }
}
