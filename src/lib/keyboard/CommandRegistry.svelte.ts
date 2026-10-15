import { SHORTCUTS, type CommandId, type ShortcutDefinition } from '../../shortcuts';

export interface CommandHandler {
  run: () => void;
  /** Hidden and inactive while false (e.g. window commands without an open window). */
  when?: () => boolean;
}

export interface AvailableCommand extends ShortcutDefinition {
  id: CommandId;
  run: () => void;
}

/**
 * Who handles which command. The app registers global handlers once; pages and windows register
 * scoped handlers while they are mounted. The newest registration whose condition holds wins, so a
 * window's list takes the list keys while it is open and returns them when it closes.
 */
export class CommandRegistry {
  /** Bumped on every change so palettes and hints re-read the available commands. */
  version = $state(0);
  paletteOpen = $state(false);

  readonly #handlers = new Map<CommandId, CommandHandler[]>();

  /** Adds handlers; returns the function that removes exactly these again. */
  register(handlers: Partial<Record<CommandId, CommandHandler>>): () => void {
    const entries = Object.entries(handlers) as [CommandId, CommandHandler][];
    for (const [id, handler] of entries) {
      const stack = this.#handlers.get(id) ?? [];
      stack.push(handler);
      this.#handlers.set(id, stack);
    }
    this.version++;
    return () => {
      for (const [id, handler] of entries) {
        const stack = this.#handlers.get(id);
        const index = stack?.lastIndexOf(handler) ?? -1;
        if (stack && index >= 0) stack.splice(index, 1);
      }
      this.version++;
    };
  }

  /** The newest handler of a command whose condition holds, if any. */
  handler(id: CommandId): CommandHandler | null {
    const stack = this.#handlers.get(id) ?? [];
    for (let i = stack.length - 1; i >= 0; i--) {
      const handler = stack[i];
      if (!handler.when || handler.when()) return handler;
    }
    return null;
  }

  /** Runs a command; false when nothing handles it right now. */
  run(id: CommandId): boolean {
    const handler = this.handler(id);
    if (!handler) return false;
    handler.run();
    return true;
  }

  /** Every command that can run now, in catalog order. */
  available(): AvailableCommand[] {
    void this.version; // re-evaluate in reactive contexts after (un)registering
    return (Object.keys(SHORTCUTS) as CommandId[]).flatMap((id) => {
      const handler = this.handler(id);
      return handler ? [{ id, ...SHORTCUTS[id], run: handler.run }] : [];
    });
  }
}
