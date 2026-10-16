import { defineEvent, type EventBus } from '../bus';
import { TOAST } from '../notify/ToastService.svelte';
import type { ErrorMessages } from './ErrorMessages';

/** Reports a failed operation to the user: `bus.publish(APP_ERROR, error)`. */
export const APP_ERROR = defineEvent<unknown>('app/error');

/** Turns reported errors into readable error toasts. */
export class ErrorReporter {
  constructor(bus: EventBus, errors: ErrorMessages) {
    bus.subscribe(APP_ERROR, (error) => bus.publish(TOAST, { text: errors.text(error), tone: 'error' }));
  }
}
