<script lang="ts">
  import { bus, commands, router, session, store, windows } from '../../lib/container';
  import { TOAST, WINDOW_OPEN } from '../../channels';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import { ROLE_LABELS } from '../../lib/types';
  import Button from '../../ui/Button.svelte';
  import DataTable from '../../ui/DataTable.svelte';
  import { windowMenu } from '../../lib/window/windowMenu';

  import Page from '../../ui/Page.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { MEMBER_DEACTIVATED, MEMBER_INVITED } from './events';
  import { MemberListModel } from './MemberListModel.svelte';
  import ResetAllDialog from './ResetAllDialog.svelte';
  import { roleHue } from './roles';
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

  <DataTable
    model={list}
    rowKey={(m) => m.id}
    onopen={(m) => bus.publish(WINDOW_OPEN, { kind: 'member', id: m.id })}
    menu={(m) => windowMenu(bus, windows, router, 'member', m.id)}
    selected={windows.current?.kind === 'member' ? windows.current.id : null}
    emptyText="Noch keine Mitglieder."
  >
    {#snippet cell(member, column)}
      {#if column.key === 'roles'}
        <span class="tags">{#each member.roles as role (role)}<Tag tone={roleHue(role)}>{ROLE_LABELS[role]}</Tag>{/each}</span>
      {:else if column.key === 'status'}
        <Tag tone={member.active ? 'green' : 'red'}>{member.active ? 'Aktiv' : 'Inaktiv'}</Tag>
      {:else if column.key === 'email'}
        <span class="muted">{member.email}</span>
      {:else}
        {list.display(member, column)}
      {/if}
    {/snippet}
  </DataTable>
  {#if list.data.value}<p class="muted small count">{list.activeCount} aktive Mitglieder</p>{/if}
</Page>

{#if resetting}<ResetAllDialog ondone={resetDone} onclose={() => (resetting = false)} />{/if}

<style>
  .tags {
    display: inline-flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
  }
  .count {
    margin-top: var(--space-sm);
  }
</style>
