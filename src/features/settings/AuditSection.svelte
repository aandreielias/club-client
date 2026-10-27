<script lang="ts">
  import { api, session } from '../../lib/container';
  import { Action } from '../../lib/state/Action.svelte';
  import type { AuditEntry } from '../../lib/types';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';

  /** Admin only: who changed what with extended rights, who opened member data, who exported data (server: AuditLog). */
  const PAGE = 100;
  const ACTIONS: Record<string, string> = { GET: 'angesehen', POST: 'angelegt', PUT: 'geändert', PATCH: 'geändert', DELETE: 'gelöscht' };

  let entries = $state<AuditEntry[]>([]);
  let more = $state(true);
  const loading = new Action();

  async function load() {
    await loading.run(async () => {
      const before = entries.at(-1)?.id;
      const page = await api.get<{ items: AuditEntry[] }>('/api/v1/audit', before ? { before } : undefined);
      entries = [...entries, ...page.items];
      more = page.items.length === PAGE;
    });
  }
  void load();

  /** "/api/v1/members/{id}/roles" with its ids filled in, without the API prefix. */
  function what(entry: AuditEntry): string {
    return entry.route.replace('/api/v1/', '').replace(/\{(\w+)\}/g, (_, name: string) => entry.params[name]?.slice(0, 8) ?? name);
  }
</script>

<div class="stack section">
  <p class="muted">
    Änderungen mit erweiterten Rechten, Einblicke von Admin und Vorstand in Mitgliederdaten und Datenexporte. Einträge lassen sich nicht ändern und
    werden nach zwei Jahren gelöscht.
  </p>
  <table>
    <thead><tr><th>Zeit</th><th>Wer</th><th>Aktion</th><th>Was</th></tr></thead>
    <tbody>
      {#each entries as entry (entry.id)}
        <tr>
          <td>{session.format.dateTime(entry.at)}</td>
          <td>{entry.actorName ?? 'Gelöschtes Mitglied'}</td>
          <td>{ACTIONS[entry.method] ?? entry.method}</td>
          <td><code>{what(entry)}</code></td>
        </tr>
      {:else}
        {#if !loading.busy}<tr><td colspan="4" class="muted">Noch keine Einträge.</td></tr>{/if}
      {/each}
    </tbody>
  </table>
  <ErrorNote error={loading.error} />
  {#if more && entries.length}<div><Button busy={loading.busy} onclick={load}>Ältere laden</Button></div>{/if}
</div>

<style>
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--font-size-small);
  }
  th,
  td {
    padding: var(--space-xs) var(--space-sm);
    border-bottom: 1px solid var(--color-border);
    text-align: left;
  }
  code {
    overflow-wrap: anywhere;
  }
</style>
