<script lang="ts">
  import { bus, commands, session, store } from '../../lib/container';
  import { TOAST, WINDOW_OPEN } from '../../channels';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import Button from '../../ui/Button.svelte';
  import MemberTable from './MemberTable.svelte';

  import Page from '../../ui/Page.svelte';
  import { MEMBER_DEACTIVATED, MEMBER_INVITED } from './events';
  import { MemberListModel } from './MemberListModel.svelte';
  import ResetAllDialog from './ResetAllDialog.svelte';
  import { memberPolicy as policy, membersApi } from './services';

  // The list needs a step-up: the PIN dialog appears on first load.
  const list = new MemberListModel(membersApi, store);
  void list.load();
  useBus(bus, [MEMBER_INVITED, MEMBER_DEACTIVATED], () => void list.load());

  let resetting = $state(false);
  useCommands(commands, { 'page.new': { run: () => bus.publish(WINDOW_OPEN, { kind: 'member-new', id: '-' }), when: () => policy.canInvite() } });

  async function resetDone(count: number) {
    resetting = false;
    bus.publish(TOAST, { text: `${count} PINs zurückgesetzt.` });
    await session.loadMe(); // the own PIN is gone as well: onboarding asks for a new one
  }
</script>

<Page title="Mitglieder">
  {#snippet actions()}
    {#if policy.canResetAll()}<Button variant="danger" onclick={() => (resetting = true)}>Alle PINs zurücksetzen</Button>{/if}
    {#if policy.canInvite()}<Button variant="primary" icon="add" onclick={() => bus.publish(WINDOW_OPEN, { kind: 'member-new', id: '-' })}>Einladen</Button>{/if}
  {/snippet}

  <MemberTable {list} />
  {#if list.data.value}<p class="muted small count">{list.activeCount} aktive Mitglieder</p>{/if}
</Page>

{#if resetting}<ResetAllDialog ondone={resetDone} onclose={() => (resetting = false)} />{/if}

<style>
  .count {
    margin-top: var(--space-sm);
  }
</style>
