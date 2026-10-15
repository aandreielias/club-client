<script lang="ts">
  import { confirmation, directory, errors, live, router, store, toasts, windows } from '../../lib/container';
  import { onLive } from '../../lib/live/onLive.svelte';
  import type { RosterEntry, TeamRole } from '../../lib/types';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import type { MenuEntry } from '../../lib/overlay/ContextMenuService.svelte';
  import { windowMenu } from '../../lib/window/windowMenu';
  import DataTable from '../../ui/DataTable.svelte';
  import Detail from '../../ui/Detail.svelte';
  import Select from '../../ui/Select.svelte';
  import Tag from '../../ui/Tag.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import AddMemberPanel from './AddMemberPanel.svelte';
  import { MEMBERSHIP_CHANGED, type MembershipChanged } from './events';
  import { RosterListModel } from './RosterListModel.svelte';
  import { RosterModel } from './RosterModel.svelte';
  import { teamPolicy as policy, teamsApi } from './services';

  /** One team: season, roster with roles; adding and removing members for those allowed. Window and page. */
  let { id, handle }: { id: string; handle?: WindowHandle } = $props();

  const ROLE_OPTIONS: readonly { value: TeamRole; label: string }[] = [
    { value: 'PLAYER', label: 'Spieler:in' },
    { value: 'COACH', label: 'Trainer:in' },
  ];

  // svelte-ignore state_referenced_locally
  const model = new RosterModel(teamsApi, directory, id);
  const list = new RosterListModel(model, store);
  void list.load();
  void directory.loadRosters([model.teamId]); // exact team roles for the permission checks

  // Writes answer with the new roster; the list shows the same entries.
  $effect(() => {
    const entries = model.roster.value?.entries;
    if (entries) list.set(entries);
  });

  let adding = $state(false);

  $effect(() => {
    const name = model.roster.value?.team.name;
    if (name) handle?.setTitle(name);
  });

  onLive<MembershipChanged>(live, MEMBERSHIP_CHANGED, ({ data }) => {
    if (data.teamId === model.teamId && !model.busy) void model.load();
  });

  async function changeRole(entry: RosterEntry, role: TeamRole) {
    if (role !== entry.teamRole && !(await model.assign(entry.memberId, role))) toasts.error(errors.text(model.assignAction.error));
  }

  async function remove(entry: RosterEntry) {
    const ok = await confirmation.ask({ title: 'Aus dem Team entfernen', message: `${entry.name} wird aus dem Team entfernt.`, confirmLabel: 'Entfernen', danger: true });
    if (!ok) return;
    if (await model.remove(entry)) toasts.show('Aus dem Team entfernt.');
    else toasts.error(errors.text(model.removeAction.error));
  }

  function open(entry: RosterEntry) {
    if (policy.canOpenProfile(model.teamId, entry)) windows.open('member', entry.memberId);
  }

  function rowMenu(entry: RosterEntry): MenuEntry[] {
    return [
      ...(policy.canOpenProfile(model.teamId, entry) ? windowMenu(windows, router, 'member', entry.memberId) : []),
      { separator: true },
      ...(policy.canRemove(model.teamId, entry) ? [{ label: 'Aus dem Team entfernen', danger: true, run: () => void remove(entry) }] : []),
    ];
  }
</script>

<Detail title={model.roster.value?.team.name ?? 'Team'}>
  {#snippet actions()}
    {#if policy.canAssign() && !adding}<Button variant="primary" onclick={() => (adding = true)}>Mitglied hinzufügen</Button>{/if}
  {/snippet}
  {#snippet meta()}
    {#if model.roster.value}
      <Tag tone="gray">Saison {model.roster.value.team.season}</Tag>
      <span class="muted">{model.roster.value.entries.length} Mitglieder</span>
    {/if}
  {/snippet}

  {#if adding}
    <div class="add"><AddMemberPanel {model} onclose={() => (adding = false)} /></div>
  {/if}

  <AsyncView resource={model.roster}>
    {#snippet children()}
      <DataTable model={list} rowKey={(e) => e.memberId} onopen={open} menu={rowMenu} emptyText="Noch keine Mitglieder im Team.">
        {#snippet cell(entry, column)}
          {#if column.key === 'role'}
            {#if policy.canAssign()}
              <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
              <span onclick={(e) => e.stopPropagation()}>
                <Select inline aria-label="Rolle von {entry.name}" value={entry.teamRole} options={ROLE_OPTIONS} disabled={model.busy}
                  onchange={(role) => changeRole(entry, role)} />
              </span>
            {:else}
              <Tag tone={entry.teamRole === 'COACH' ? 'blue' : 'green'}>{list.display(entry, column)}</Tag>
            {/if}
          {:else if column.key === 'actions'}
            {#if policy.canRemove(model.teamId, entry)}
              <Button size="sm" variant="ghost" disabled={model.busy} onclick={(e) => (e.stopPropagation(), remove(entry))} tooltip="Aus dem Team entfernen">Entfernen</Button>
            {/if}
          {:else}
            {list.display(entry, column)}
          {/if}
        {/snippet}
      </DataTable>
    {/snippet}
  </AsyncView>
</Detail>

<style>
  .add {
    margin-bottom: var(--space-lg);
  }
</style>
