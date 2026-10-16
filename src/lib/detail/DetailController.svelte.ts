import type { EventBus, EventChannel } from '../bus';
import { APP_ERROR } from '../errors/ErrorReporter';
import type { LiveEvent } from '../live/LiveUpdates.svelte';
import { CONFIRM, type ConfirmRequest } from '../notify/ConfirmService.svelte';
import { TOAST } from '../notify/ToastService.svelte';
import type { BackStack } from '../navigation/BackStack.svelte';
import { Action } from '../state/Action.svelte';
import { WINDOW_OPEN, type WindowHandle } from '../window/WindowService.svelte';

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
  /** Set once the view closes, so the server's echo of our own delete is not reported again. */
  #left = false;

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
    if (this.#left) return;
    this.#left = true;
    if (this.handle) this.handle.close();
    else this.onclosed?.();
  }

  /** Opens a related record: inside a window with a way back, on a page in the window. */
  open(kind: string, id: string): void {
    if (this.handle) this.handle.open(kind, id);
    else this.bus.publish(WINDOW_OPEN, { kind, id });
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
        if (this.#left || !mine(data) || options.busy()) return;
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

/** The edit mode of a record view: the open form, its save action and the submit flow. Escape leaves it. */
export class EditSession<F> {
  form = $state<F | null>(null);
  /** Something was typed or picked since editing started (see `track`). */
  dirty = $state(false);
  readonly save = new Action();

  constructor(
    private readonly bus: EventBus,
    backStack?: BackStack,
  ) {
    backStack?.while(() => this.editing, () => void this.cancel(), () => this.mayDiscard(), () => this.dirty);
  }

  get editing(): boolean {
    return this.form !== null;
  }

  edit(form: F): void {
    this.save.reset();
    this.dirty = false;
    this.form = form;
  }

  /** Leaves edit mode; asks first when there are unsaved changes. Resolves true when it left. */
  async cancel(): Promise<boolean> {
    if (!(await this.mayDiscard())) return false;
    this.form = null;
    return true;
  }

  /** True without asking when nothing changed. */
  mayDiscard(): boolean | Promise<boolean> {
    return !this.dirty || this.bus.request(CONFIRM, EditSession.DISCARD);
  }

  /** Attach to the element around the editor: any input or change inside marks the session dirty. */
  readonly track = (node: HTMLElement): (() => void) => {
    const mark = () => (this.dirty = true);
    node.addEventListener('input', mark);
    node.addEventListener('change', mark);
    return () => {
      node.removeEventListener('input', mark);
      node.removeEventListener('change', mark);
    };
  };

  static readonly DISCARD: ConfirmRequest = {
    title: 'Änderungen verwerfen',
    message: 'Deine Änderungen sind noch nicht gespeichert.',
    confirmLabel: 'Verwerfen',
    danger: true,
  };

  /** Runs the write with the open form; on success closes the form and shows `success`. */
  async submit(write: (form: F) => Promise<unknown>, success: string): Promise<boolean> {
    const form = this.form;
    if (!form || !(await this.save.run(() => write(form)))) return false;
    this.form = null;
    this.dirty = false;
    this.bus.publish(TOAST, { text: success });
    return true;
  }
}
