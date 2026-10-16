<script lang="ts">
  import { activityApi, bus, session, store } from '../../lib/container';
  import { WINDOW_OPEN } from '../../channels';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import { settings } from '../../settings';
  import Button from '../../ui/Button.svelte';
  import DataTable from '../../ui/DataTable.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Page from '../../ui/Page.svelte';
  import { APPOINTMENTS_CHANGED } from '../calendar/events';
  import { FILES_CHANGED } from '../files/events';
  import { TASK_CHANGED } from '../tasks/events';
  import { ActivityFeedModel } from './ActivityFeedModel.svelte';
  import { recordWindow } from './open';

  /** "Logs": who changed which task, appointment or file. Admin and board see all, coaches their teams. */
  const list = new ActivityFeedModel(activityApi, () => session.format, store, settings.activity.pageSize);
  void list.load();
  // New changes arrive with the record's own live event; reload unless older pages are shown.
  useBus(bus, [TASK_CHANGED, APPOINTMENTS_CHANGED, FILES_CHANGED], () => {
    if ((list.data.value?.length ?? 0) <= settings.activity.pageSize) void list.load();
  });

  function open(entry: Parameters<typeof recordWindow>[0]) {
    const target = recordWindow(entry);
    if (target) bus.publish(WINDOW_OPEN, target);
  }
</script>

<Page title="Logs">
  <DataTable model={list} rowKey={(e) => `${e.kind}:${e.recordId}:${e.at}:${e.action}`} onopen={open} emptyText="Noch keine Änderungen aufgezeichnet." />
  <ErrorNote error={list.more.error} />
  {#if list.hasMore}
    <div class="more"><Button busy={list.more.busy} onclick={() => list.loadMore()}>Ältere laden</Button></div>
  {/if}
</Page>

<style>
  .more {
    display: flex;
    justify-content: center;
    margin-top: var(--space-md);
  }
</style>
