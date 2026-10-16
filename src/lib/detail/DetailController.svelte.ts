import type { EventBus, EventChannel } from '../bus';
import { APP_ERROR } from '../errors/ErrorReporter';
import type { LiveEvent } from '../live/LiveUpdates.svelte';
import { CONFIRM, type ConfirmRequest } from '../notify/ConfirmService.svelte';
import { TOAST } from '../notify/ToastService.svelte';
import { Action } from '../state/Action.svelte';
import type { WindowHandle } from '../window/WindowService.svelte';

export interface WatchOptions<T> {
  /** Toast shown when the record was deleted elsewhere; the view then closes. */
  deleted: string;
  /** While true (own write running), events are ignored: the write reloads by itself. */
  busy: () => boolean;
  changed: (data: T) => void;
}

/**
 * Shared behaviour of every record view (window or page): window title, leaving, confirmed writes
 * with a toast, and reacting to live changes of the shown record. Create during component initialisation.
 */
export class DetailController {
  constructor(
    protected readonly bus: EventBus,
    private readonly handle?: WindowHandle,
    private readonly onclosed?: () => void,
  ) {}

  /** Keeps the window title in step with the loaded record. */
  title(read: () => string | undefined): void {
    $effect(() => {
      const title = read();
      if (title) this.handle?.setTitle(title);
    });
  }

  leave(): void {
    if (this.handle) this.handle.close();
    else this.onclosed?.();
  }

  notify(text: string): void {
    this.bus.publish(TOAST, { text });
  }

  /** Asks first; on yes runs the write and shows `success`. Resolves true when it went through. */
  async confirm(request: ConfirmRequest, run: () => Promise<boolean>, success: string): Promise<boolean> {
    if (!(await this.bus.request(CONFIRM, request)) || !(await run())) return false;
    this.notify(success);
    return true;
  }

  /** Runs a model write and reports its error (kept in `action`) as an error toast when it fails. */
  async attempt(action: Action, write: () => Promise<boolean>): Promise<boolean> {
    const ok = await write();
    if (!ok) this.bus.publish(APP_ERROR, action.error);
    return ok;
  }

  /** Live changes of this record: `DELETED` closes the view with a toast, anything else calls `changed`. */
  watch<T extends { change: string }>(channel: EventChannel<LiveEvent<T>>, mine: (data: T) => boolean, options: WatchOptions<T>): void {
    $effect(() => {
      const subscription = this.bus.subscribe(channel, ({ data }) => {
        if (!mine(data) || options.busy()) return;
        if (data.change === 'DELETED') {
          this.notify(options.deleted);
          this.leave();
        } else {
          options.changed(data);
        }
      });
      return () => subscription.unsubscribe();
    });
  }
}

/** The edit mode of a record view: the open form, its save action and the submit flow. */
export class EditSession<F> {
  form = $state<F | null>(null);
  readonly save = new Action();

  constructor(private readonly bus: EventBus) {}

  get editing(): boolean {
    return this.form !== null;
  }

  edit(form: F): void {
    this.save.reset();
    this.form = form;
  }

  cancel(): void {
    this.form = null;
  }

  /** Runs the write with the open form; on success closes the form and shows `success`. */
  async submit(write: (form: F) => Promise<unknown>, success: string): Promise<boolean> {
    const form = this.form;
    if (!form || !(await this.save.run(() => write(form)))) return false;
    this.form = null;
    this.bus.publish(TOAST, { text: success });
    return true;
  }
}
