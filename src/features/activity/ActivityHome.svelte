<script lang="ts">
  import { activityApi, bus, session } from '../../lib/container';
  import { ADMIN_BOARD } from '../../lib/types';
  import { settings } from '../../settings';
  import DataTable from '../../ui/DataTable.svelte';
  import SectionHeading from '../../ui/SectionHeading.svelte';
  import { ActivityFeedModel } from './ActivityFeedModel.svelte';
  import { entryKey, openRecord } from './open';

  /** Start page section: the newest changes. */
  const list = new ActivityFeedModel(activityApi, () => session.format, null, settings.home.listRows);
  void list.load();
</script>

<SectionHeading title="Aktivität" href={session.hasRole(...ADMIN_BOARD) ? '#/activity' : undefined} />
<DataTable
  model={list}
  toolbar={false}
  limit={settings.home.listRows}
  rowKey={entryKey}
  onopen={(e) => openRecord(bus, e)}
  emptyText="Noch keine Änderungen aufgezeichnet."
/>
