<script lang="ts">
  import { auditApi, session, store } from '../../lib/container';
  import LoadMore from '../../ui/LoadMore.svelte';
  import DataTable from '../../ui/DataTable.svelte';
  import { AuditListModel } from './AuditListModel.svelte';

  /** Admin only: who changed what with extended rights, who opened member data, who exported data (server: AuditLog). */
  const list = new AuditListModel(auditApi, () => session.format, store);
  void list.load();
</script>

<div class="stack">
  <p class="muted small">
    Änderungen mit erweiterten Rechten, Einblicke von Admin und Vorstand in Mitgliederdaten und Datenexporte. Einträge lassen sich nicht ändern und
    werden nach zwei Jahren gelöscht. Art, Bereich und Person filtern das ganze Protokoll, die Suche die geladenen Einträge.
  </p>
  <DataTable model={list} rowKey={(e) => String(e.id)} emptyText="Keine Einträge." />
  {#if list.hasMore}<LoadMore action={list.more} onload={() => list.loadMore()} />{/if}
</div>
