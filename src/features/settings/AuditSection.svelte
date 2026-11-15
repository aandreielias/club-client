<script lang="ts">
  import { auditApi, directory, session, store } from '../../lib/container';
  import LoadMore from '../../ui/LoadMore.svelte';
  import DataTable from '../../ui/DataTable.svelte';
  import { AuditListModel } from './AuditListModel.svelte';

  /** Admin only: who changed what with extended rights, who opened member data, who exported data (server: AuditLog). */
  const list = new AuditListModel(
    auditApi,
    () => session.format,
    store,
    (id) => directory.knownName(id),
  );
  void list.load();
  void directory.loadNames();
</script>

<div class="stack">
  <DataTable model={list} rowKey={(e) => String(e.id)} emptyText="Keine Einträge." />
  {#if list.hasMore}<LoadMore action={list.more} onload={() => list.loadMore()} />{/if}
</div>
