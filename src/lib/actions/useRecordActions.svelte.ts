import { untrack } from 'svelte';
import type { CommandId } from '../../shortcuts';
import type { CommandHandler, CommandRegistry } from '../keyboard/CommandRegistry.svelte';
import { currentPane } from '../split/Pane';
import type { RecordAction, RecordActionProvider } from './RecordActions';

export interface RecordActionsHandle {
  readonly list: readonly RecordAction[];
  has(command: CommandId): boolean;
  /** Runs the action's command (its button in the view); then a leaving action closes the view, others call `done`. */
  run(command: CommandId): Promise<void>;
  label(command: CommandId): string | undefined;
}

/**
 * The actions of the record a view shows, from its feature's provider: registered as commands
 * (keys, palette) while the view is mounted, and run by the view's buttons. Call during initialisation.
 * Actions carried out by the view itself (`inWindow`, edit forms) are left to the view's own commands.
 * `done` reloads a view that live events do not refresh.
 */
export function useRecordActions<T>(
  registry: CommandRegistry,
  provider: RecordActionProvider<T>,
  record: () => T | null | undefined,
  leave: () => void,
  done?: () => unknown,
): RecordActionsHandle {
  const list = $derived.by(() => {
    const value = record();
    return value ? provider.actions(value) : [];
  });
  const find = (command: CommandId) => list.find((a) => a.command === command);
  const runAction = async (action: RecordAction) => {
    const ok = await action.run();
    if (ok === false || action.inWindow) return;
    if (action.leaves) leave();
    else await done?.();
  };
  const pane = currentPane();
  $effect(() => {
    const handlers: Partial<Record<CommandId, CommandHandler>> = {};
    for (const action of list) {
      if (!action.inWindow) handlers[action.command] = { run: () => void runAction(action), ...(pane ? { when: () => pane.active } : {}) };
    }
    // Untracked: registering bumps the registry's version, which must not re-run this effect.
    return untrack(() => registry.register(handlers));
  });
  return {
    get list() {
      return list;
    },
    has: (command) => !!find(command),
    run: async (command) => {
      const action = find(command);
      if (action) await runAction(action);
    },
    label: (command) => find(command)?.label,
  };
}
