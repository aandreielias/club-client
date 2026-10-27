<script lang="ts">
  import { auditApi, session, store } from '../../lib/container';
  import Button from '../../ui/Button.svelte';
  import DataTable from '../../ui/DataTable.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import { AuditListModel } from './AuditListModel.svelte';

  /** Admin only: who changed what with extended rights, who opened member data, who exported data (server: AuditLog). */
  const list = new AuditListModel(auditApi, () => session.format, store);
  void list.load();
</script>

<div class="stack section">
  <p class="muted">
    Änderungen mit erweiterten Rechten, Einblicke von Admin und Vorstand in Mitgliederdaten und Datenexporte. Einträge lassen sich nicht ändern und
    werden nach zwei Jahren gelöscht. Art, Bereich und Person filtern das ganze Protokoll, die Suche die geladenen Einträge.
  </p>
  <DataTable model={list} rowKey={(e) => String(e.id)} emptyText="Keine Einträge." />
  <ErrorNote error={list.more.error} />
  {#if list.hasMore}<div><Button busy={list.more.busy} onclick={() => list.loadMore()}>Ältere laden</Button></div>{/if}
</div>
