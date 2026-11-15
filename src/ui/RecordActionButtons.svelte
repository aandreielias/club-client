<script lang="ts">
  import { actionLabel } from '../lib/actions/RecordActions';
  import type { RecordActionsHandle } from '../lib/actions/useRecordActions.svelte';
  import { SHORTCUTS, type CommandId } from '../shortcuts';
  import Button from './Button.svelte';

  /** A record's actions (its feature's provider) as the buttons of its window; `except` leaves out what the view shows elsewhere. */
  let { actions, except = [] }: { actions: RecordActionsHandle; except?: readonly CommandId[] } = $props();

  let running = $state<CommandId | null>(null);
  async function run(command: CommandId) {
    running = command;
    try {
      await actions.run(command);
    } finally {
      running = null;
    }
  }
</script>

{#each actions.list.filter((a) => !except.includes(a.command)) as action (action.command)}
  <Button
    variant={action.danger ? 'danger' : 'default'}
    icon={action.icon}
    command={action.command}
    tooltip={SHORTCUTS[action.command].label}
    busy={running === action.command}
    onclick={() => run(action.command)}>{actionLabel(action)}</Button
  >
{/each}
