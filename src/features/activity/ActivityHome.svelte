<script lang="ts">
  import { activityApi, bus, session } from '../../lib/container';
  import { WINDOW_OPEN } from '../../channels';
  import { settings } from '../../settings';
  import DataTable from '../../ui/DataTable.svelte';
  import SectionHeading from '../../ui/SectionHeading.svelte';
  import { ActivityFeedModel } from './ActivityFeedModel.svelte';
  import { recordWindow } from './open';

  /** Start page section: the newest changes. */
  const list = new ActivityFeedModel(activityApi, () => session.format, null, settings.home.listRows);
  void list.load();
</script>

<SectionHeading title="Logs" href="#/activity" />
<DataTable model={list} toolbar={false} limit={settings.home.listRows} rowKey={(e) => `${e.kind}:${e.recordId}:${e.at}:${e.action}`}
  onopen={(e) => { const target = recordWindow(e); if (target) bus.publish(WINDOW_OPEN, target); }} emptyText="Noch keine Änderungen aufgezeichnet." />
