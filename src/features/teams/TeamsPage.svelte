<script lang="ts">
  import { bus, commands, permissions, session, store } from '../../lib/container';
  import { WINDOW_OPEN } from '../../channels';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import Button from '../../ui/Button.svelte';
  import TeamTable from './TeamTable.svelte';
  import Page from '../../ui/Page.svelte';
  import { TEAMS_CHANGED } from './events';
  import { TeamListModel } from '../../lib/directory/TeamListModel.svelte';
  import { teamPolicy, teamsApi } from './services';

  const list = new TeamListModel(async () => [...(permissions.isManager ? await teamsApi.list(false) : session.teams)], session, store);
  void list.load();

  useBus(bus, TEAMS_CHANGED, () => void list.load());
  const create = () => bus.publish(WINDOW_OPEN, { kind: 'team-new', id: '-' });
  useCommands(commands, { 'page.new': { run: create, when: () => teamPolicy.canCreate() } });
</script>

<Page title="Teams">
  {#snippet actions()}
    {#if teamPolicy.canCreate()}<Button variant="primary" icon="add" onclick={create}>Neues Team</Button>{/if}
  {/snippet}

  <TeamTable
    {list}
    emptyText={teamPolicy.canCreate() ? 'Noch keine Teams.' : undefined}
    emptyAction={teamPolicy.canCreate() ? { label: 'Neues Team', icon: 'add', run: create } : null}
  />
</Page>
