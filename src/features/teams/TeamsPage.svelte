<script lang="ts">
  import { bus, commands, directory, permissions, session, store } from '../../lib/container';
  import { TOAST, WINDOW_OPEN } from '../../channels';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import type { Team } from '../../lib/types';
  import Button from '../../ui/Button.svelte';
  import TeamTable from './TeamTable.svelte';
  import Page from '../../ui/Page.svelte';
  import CreateTeamDialog from './CreateTeamDialog.svelte';
  import { TeamListModel } from '../../lib/directory/TeamListModel.svelte';
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

  <TeamTable {list} emptyAction={teamPolicy.canCreate() ? { label: 'Neues Team', icon: 'add', run: () => (creating = true) } : null} />
</Page>

{#if creating}<CreateTeamDialog oncreated={created} onclose={() => (creating = false)} />{/if}
