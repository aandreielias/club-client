import type { EventBus } from '../bus';
import { APP_ERROR } from '../errors/ErrorReporter';
import { TOAST } from '../notify/ToastService.svelte';

/** Copies a link to an app location (hash path, e.g. "/files/f-1") and confirms it with a toast. */
export class LinkClipboard {
  static url(hashPath: string): string {
    return `${location.origin}${location.pathname}#${hashPath}`;
  }

  static async copy(bus: EventBus, hashPath: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(LinkClipboard.url(hashPath));
      bus.publish(TOAST, { text: 'Link kopiert.' });
    } catch (error) {
      bus.publish(APP_ERROR, error);
    }
  }
}
