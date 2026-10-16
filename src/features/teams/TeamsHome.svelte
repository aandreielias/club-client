<script lang="ts">
  import { settings } from '../../settings';
  import { session } from '../../lib/container';
  import SectionHeading from '../../ui/SectionHeading.svelte';
  import { TeamListModel } from '../../lib/directory/TeamListModel.svelte';
  import TeamTable from './TeamTable.svelte';

  /** Start page section: the member's own teams. */
  const list = new TeamListModel(async () => [...session.teams], session, null);
  void list.load();
</script>

<SectionHeading title="Meine Teams" href="#/teams" />
<TeamTable {list} toolbar={false} limit={settings.home.listRows} />
