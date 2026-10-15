import { untrack } from 'svelte';
import type { CommandId } from '../../shortcuts';
import type { CommandHandler, CommandRegistry } from './CommandRegistry.svelte';

/** Registers command handlers for the lifetime of the calling component. Call during initialisation. */
export function useCommands(registry: CommandRegistry, handlers: Partial<Record<CommandId, CommandHandler>>): void {
  // Untracked: registering bumps the registry's version, which must not re-run this effect.
  $effect(() => untrack(() => registry.register(handlers)));
}
