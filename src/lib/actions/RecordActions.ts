import type { IconName } from '../../icons';
import { SHORTCUTS, type CommandId } from '../../shortcuts';
import type { EventBus } from '../bus';
import { APP_ERROR } from '../errors/ErrorReporter';
import { CONFIRM, type ConfirmRequest } from '../notify/ConfirmService.svelte';
import { TOAST } from '../notify/ToastService.svelte';
import { WINDOW_OPEN } from '../window/WindowService.svelte';

/**
 * One thing that can be done with a record. The same action is a context-menu row (wherever the
 * record appears), a button in its window, a command with keys and a row in the command palette.
 */
export interface RecordAction {
  /** Catalog command (src/shortcuts.ts): its label, keys and palette entry. */
  command: CommandId;
  /** Replaces the catalog label where it depends on the record ("Wieder öffnen"). */
  label?: string;
  icon?: IconName;
  danger?: boolean;
  /** Menus draw a line where the group changes. */
  group?: string;
  /** Resolves false when it did not go through (declined, failed). */
  run: () => unknown;
  /** The record is gone afterwards (delete): its view closes. */
  leaves?: boolean;
  /** Carried out by the record's own view (edit forms): runs the command there, opening the window first. */
  inWindow?: boolean;
}

/** The actions of one record kind (a window kind), given by its feature (`Feature.actions`). */
export interface RecordActionProvider<T> {
  load(id: string): Promise<T>;
  /** Only the actions the member may take on this record now. */
  actions(record: T): readonly RecordAction[];
}

export class RecordActionRegistry {
  readonly #providers = new Map<string, RecordActionProvider<unknown>>();

  register(kind: string, provider: RecordActionProvider<unknown>): this {
    if (this.#providers.has(kind)) throw new Error(`Record actions of "${kind}" registered twice`);
    this.#providers.set(kind, provider);
    return this;
  }

  provider(kind: string): RecordActionProvider<unknown> | undefined {
    return this.#providers.get(kind);
  }
}

export const actionLabel = (action: RecordAction): string => action.label ?? SHORTCUTS[action.command].label;

/** An action the record's view carries out itself (edit form): opens the window and runs the command there. */
export function inWindow(bus: EventBus, kind: string, id: string, command: CommandId, extra: Partial<RecordAction> = {}): RecordAction {
  return { command, ...extra, inWindow: true, run: () => bus.publish(WINDOW_OPEN, { kind, id, command }) };
}

/** Runs a write, shows `success`, reports a failure as an error toast. True when it went through. */
export async function attempt(bus: EventBus, write: () => Promise<unknown>, success?: string): Promise<boolean> {
  try {
    await write();
    if (success) bus.publish(TOAST, { text: success });
    return true;
  } catch (error) {
    bus.publish(APP_ERROR, error);
    return false;
  }
}

/** Asks first, then like `attempt`. */
export async function confirmed(bus: EventBus, request: ConfirmRequest, write: () => Promise<unknown>, success: string): Promise<boolean> {
  return (await bus.request(CONFIRM, request)) ? attempt(bus, write, success) : false;
}
