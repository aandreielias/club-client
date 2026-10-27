<script lang="ts">
  import type { Team } from '../lib/types';
  import type { TeamListModel } from '../lib/directory/TeamListModel.svelte';
  import DataTable from './DataTable.svelte';

  /** Choosing teams in the same list as the teams page (search, season filter, sorting), with checkboxes. */
  let {
    list,
    chosen,
    ontoggle,
    error,
  }: { list: TeamListModel; chosen: readonly string[]; ontoggle: (teamId: string) => void; error?: string | null } = $props();

  const check = {
    checked: (t: Team) => chosen.includes(t.id),
    toggle: (t: Team) => ontoggle(t.id),
    label: (t: Team) => `${t.name} auswählen`,
  };
</script>

<div class="picker">
  <DataTable model={list} rowKey={(t) => t.id} {check} emptyText="Keine passenden Teams.">
    {#snippet actions()}
      <span class="muted count">{chosen.length} ausgewählt</span>
    {/snippet}
  </DataTable>
  {#if error}<span class="error" role="alert">{error}</span>{/if}
</div>

<style>
  .picker {
    display: grid;
    gap: var(--space-xs);
  }
  .count {
    font-size: var(--font-size-small);
    white-space: nowrap;
  }
  .error {
    color: var(--color-danger);
    font-size: var(--font-size-small);
  }
</style>
