<script lang="ts">
  import { activityApi, bus, session, store } from '../../lib/container';
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
  import { entryKey, openRecord } from './open';

  /** "Logs": who changed which task, appointment or file. Admin and board see all, coaches their teams. */
  const list = new ActivityFeedModel(activityApi, () => session.format, store, settings.activity.pageSize);
  void list.load();
  // New changes arrive with the record's own live event; reload unless older pages are shown.
  useBus(bus, [TASK_CHANGED, APPOINTMENTS_CHANGED, FILES_CHANGED], () => {
    if ((list.data.value?.length ?? 0) <= settings.activity.pageSize) void list.load();
  });
</script>

<Page title="Logs">
  <DataTable model={list} rowKey={entryKey} onopen={(e) => openRecord(bus, e)} emptyText="Noch keine Änderungen aufgezeichnet." />
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
