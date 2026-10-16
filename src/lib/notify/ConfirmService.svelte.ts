import { defineRequest, type EventBus } from '../bus';

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  /** Styles the confirm button as destructive. */
  danger?: boolean;
}

/** Asks the user: `await bus.request(CONFIRM, {...})` resolves true when confirmed. */
export const CONFIRM = defineRequest<ConfirmRequest, boolean>('ui/confirm', { timeoutMs: 0 });

/** Promise-based confirmation dialog (rendered once by the app shell), instead of window.confirm. */
export class ConfirmService {
  current = $state.raw<ConfirmRequest | null>(null);

  #resolve: ((ok: boolean) => void) | null = null;

  constructor(bus: EventBus) {
    bus.handleRequest(CONFIRM, (request) => this.ask(request));
  }

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
