import type { EventBus } from '../bus';
import { defineEvent } from '../bus';

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface ToastRequest {
  text: string;
  tone?: 'info' | 'error';
  /** A button in the toast (e.g. "Rückgängig"); clicking it also closes the toast. */
  action?: ToastAction;
  /** Overrides the default display time. */
  durationMs?: number;
}

/** Shows a toast: `bus.publish(TOAST, { text })`. */
export const TOAST = defineEvent<ToastRequest>('ui/toast');

export interface Toast {
  id: number;
  text: string;
  error: boolean;
  action?: ToastAction;
}

/** Short, self-dismissing status messages. */
export class ToastService {
  items = $state<Toast[]>([]);

  #next = 0;

  constructor(
    bus: EventBus,
    private readonly durationMs: number,
    private readonly errorDurationMs: number,
  ) {
    bus.subscribe(TOAST, ({ text, tone, action, durationMs }) =>
      this.push(text, tone === 'error', durationMs ?? (tone === 'error' ? this.errorDurationMs : this.durationMs), action),
    );
  }

  dismiss(id: number): void {
    const index = this.items.findIndex((t) => t.id === id);
    if (index >= 0) this.items.splice(index, 1);
  }

  private push(text: string, error: boolean, durationMs: number, action?: ToastAction): void {
    const id = this.#next++;
    this.items.push({ id, text, error, action });
    setTimeout(() => this.dismiss(id), durationMs);
  }
}
