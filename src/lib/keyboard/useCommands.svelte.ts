import { untrack } from 'svelte';
import type { CommandId } from '../../shortcuts';
import { currentPane } from '../split/Pane';
import type { CommandHandler, CommandRegistry } from './CommandRegistry.svelte';

/**
 * Registers command handlers for the lifetime of the calling component. Call during initialisation.
 * Inside a pane of the split view, they only work while that pane has the focus.
 */
export function useCommands(registry: CommandRegistry, handlers: Partial<Record<CommandId, CommandHandler>>): void {
  const pane = currentPane();
  const scoped = pane
    ? Object.fromEntries(Object.entries(handlers).map(([id, h]) => [id, { run: h.run, when: () => pane.active && (!h.when || h.when()) }]))
    : handlers;
  // Untracked: registering bumps the registry's version, which must not re-run this effect.
  $effect(() => untrack(() => registry.register(scoped)));
}
