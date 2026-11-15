<script lang="ts">
  import { activityApi, bus, session, store } from '../../lib/container';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import { usePane } from '../../lib/split/usePane';
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';
  import { settings } from '../../settings';
  import DataTable from '../../ui/DataTable.svelte';
  import LoadMore from '../../ui/LoadMore.svelte';
  import Page from '../../ui/Page.svelte';
  import { APPOINTMENTS_CHANGED } from '../calendar/events';
  import { FILES_CHANGED } from '../files/events';
  import AuditSection from '../settings/AuditSection.svelte';
  import { TASK_CHANGED } from '../tasks/events';
  import { ActivityFeedModel } from './ActivityFeedModel.svelte';
  import { entryKey, openRecord } from './open';

  /**
   * "Protokolle" (admin/board): the activity (who changed which task, appointment or file) and, for admins, the access log
   * (`?view=zugriffe`: changes with extended rights, views of member data, exports).
   */
  const VIEWS = [
    { value: 'activity', label: 'Aktivität' },
    { value: 'zugriffe', label: 'Zugriffe' },
  ];
  const ACCESS_HINT =
    'Änderungen mit erweiterten Rechten, Einblicke von Admin und Vorstand in Mitgliederdaten und Datenexporte. Einträge lassen sich nicht ändern und werden nach zwei Jahren gelöscht. Art, Bereich und Person filtern das ganze Protokoll, die Suche die geladenen Einträge.';
  const pane = usePane();
  const admin = session.hasRole('ADMIN');
  const view = $derived(admin && pane.query.get('view') === 'zugriffe' ? 'zugriffe' : 'activity');

  const list = new ActivityFeedModel(activityApi, () => session.format, store, settings.activity.pageSize);
  void list.load();
  // New changes arrive with the record's own live event; reload unless older pages are shown.
  useBus(bus, [TASK_CHANGED, APPOINTMENTS_CHANGED, FILES_CHANGED], () => {
    if ((list.data.value?.length ?? 0) <= settings.activity.pageSize) void list.load();
  });
</script>

<Page title="Protokolle" hint={view === 'zugriffe' ? ACCESS_HINT : undefined}>
  {#snippet actions()}
    {#if admin}
      <ChoiceGroup
        name="log-view"
        label="Protokoll"
        options={VIEWS}
        bind:value={() => view, (v) => pane.updateQuery({ view: v === 'zugriffe' ? v : null }, true)}
      />
    {/if}
  {/snippet}
  {#if view === 'zugriffe'}
    <AuditSection />
  {:else}
    <DataTable model={list} rowKey={entryKey} onopen={(e) => openRecord(bus, e)} emptyText="Noch keine Änderungen aufgezeichnet." />
    {#if list.hasMore}<LoadMore action={list.more} onload={() => list.loadMore()} />{/if}
  {/if}
</Page>
