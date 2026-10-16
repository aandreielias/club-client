<script lang="ts">
  import { bus, commands, directory, permissions, router, session, store, windows } from '../../lib/container';
  import { TOAST, WINDOW_OPEN } from '../../channels';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import type { Team } from '../../lib/types';
  import Button from '../../ui/Button.svelte';
  import { windowMenu } from '../../lib/window/windowMenu';
  import DataTable from '../../ui/DataTable.svelte';
  import Page from '../../ui/Page.svelte';
  import Tag from '../../ui/Tag.svelte';
  import CreateTeamDialog from './CreateTeamDialog.svelte';
  import { TeamListModel } from './TeamListModel.svelte';
  import { teamPolicy, teamsApi } from './services';

  const list = new TeamListModel(async () => [...(permissions.isManager ? await teamsApi.list(false) : session.teams)], session, store);
  void list.load();

  let creating = $state(false);
  useCommands(commands, { 'page.new': { run: () => (creating = true), when: () => teamPolicy.canCreate() } });

  function created(team: Team) {
    creating = false;
    directory.forgetTeams();
    bus.publish(TOAST, { text: 'Team angelegt.' });
    bus.publish(WINDOW_OPEN, { kind: 'team', id: team.id });
  }
</script>

<Page title="Teams">
  {#snippet actions()}
    {#if teamPolicy.canCreate()}<Button variant="primary" icon="add" onclick={() => (creating = true)}>Neues Team</Button>{/if}
  {/snippet}

  <DataTable model={list} rowKey={(t) => t.id} onopen={(t) => bus.publish(WINDOW_OPEN, { kind: 'team', id: t.id })}
    menu={(t) => windowMenu(bus, windows, router, 'team', t.id)} emptyText="Du bist noch in keinem Team.">
    {#snippet cell(team, column)}
      {#if column.key === 'mine'}
        {#if session.isInTeam(team.id)}<Tag tone="blue">Mein Team</Tag>{/if}
      {:else}
        {list.display(team, column)}
      {/if}
    {/snippet}
  </DataTable>
</Page>

{#if creating}<CreateTeamDialog oncreated={created} onclose={() => (creating = false)} />{/if}
