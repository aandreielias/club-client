import type { CommandId } from '../../shortcuts';
import type { CommandRegistry } from './CommandRegistry.svelte';
import type { Keymap } from './Keymap.svelte';
import { KeySpec, type KeyInput } from './KeySpec';

export interface KeyEventLike extends KeyInput {
  target: EventTarget | null;
  defaultPrevented?: boolean;
  repeat?: boolean;
  preventDefault(): void;
}

/**
 * Turns key presses into commands. Handles sequences (G, then K) with a timeout, stays out of the
 * way while the user types (only Mod/Ctrl/Alt combos and Escape, also Shift+Escape, reach commands then), and leaves
 * native modal dialogs (PIN, confirmations) alone.
 */
export class KeyboardService {
  /** Steps typed so far of an unfinished sequence. */
  pending = $state<string[]>([]);
  /** False while a shortcut is being recorded in the settings. */
  enabled = $state(true);

  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly commands: CommandRegistry,
    private readonly keymap: Keymap,
    private readonly sequenceTimeoutMs: number,
    readonly isMac: boolean,
  ) {}

  attach(target: Window = window): () => void {
    const listener = (event: KeyboardEvent) => this.handle(event);
    target.addEventListener('keydown', listener);
    return () => {
      target.removeEventListener('keydown', listener);
      this.clearPending();
    };
  }

  /** Processes one key event; true when it ran or continued a shortcut. */
  handle(event: KeyEventLike): boolean {
    if (!this.enabled || event.defaultPrevented || KeyboardService.inModalDialog(event.target)) return false;
    const combo = KeySpec.fromEvent(event, this.isMac);
    if (!combo) return false;
    if (KeyboardService.isTyping(event.target) && !this.pending.length && !KeySpec.hasCommandModifier(combo) && !/(^|\+)Escape$/.test(combo))
      return false;
    // Enter on a focused button or link keeps its native meaning.
    if (combo === 'Enter' && KeyboardService.isInteractive(event.target)) return false;

    const steps = [...this.pending, combo];
    const spec = steps.join(' ');
    const runnable = this.keymap.commandsFor(spec).find((id) => this.commands.handler(id));
    if (runnable) {
      event.preventDefault();
      this.clearPending();
      this.commands.run(runnable);
      return true;
    }
    if (this.keymap.continuations(steps).some(({ id }) => this.commands.handler(id))) {
      event.preventDefault();
      this.pending = steps;
      clearTimeout(this.#timer);
      this.#timer = setTimeout(() => this.clearPending(), this.sequenceTimeoutMs);
      return true;
    }
    const hadPending = this.pending.length > 0;
    this.clearPending();
    // A wrong second key starts over: it may begin another shortcut itself.
    return hadPending ? this.handle(event) : false;
  }

  /** Possible next keys of the pending sequence, for the on-screen hint. */
  nextSteps(): { id: CommandId; next: string }[] {
    if (!this.pending.length) return [];
    return this.keymap.continuations(this.pending).filter(({ id }) => this.commands.handler(id));
  }

  clearPending(): void {
    clearTimeout(this.#timer);
    if (this.pending.length) this.pending = [];
  }

  static isTyping(target: EventTarget | null): boolean {
    const element = target as HTMLElement | null;
    if (!element || typeof element.tagName !== 'string') return false;
    if (element.isContentEditable) return true;
    const tag = element.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (tag !== 'INPUT') return false;
    const type = (element as HTMLInputElement).type;
    return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'file', 'color'].includes(type);
  }

  private static isInteractive(target: EventTarget | null): boolean {
    const element = target as HTMLElement | null;
    return !!element && typeof element.tagName === 'string' && ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA', 'SUMMARY'].includes(element.tagName);
  }

  private static inModalDialog(target: EventTarget | null): boolean {
    const element = target as HTMLElement | null;
    return !!element?.closest?.('dialog[open]');
  }
}
