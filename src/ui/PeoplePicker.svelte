<script lang="ts">
  import type { Person, PersonListModel } from '../lib/directory/PersonListModel.svelte';
  import DataTable from './DataTable.svelte';

  /**
   * Choosing people (photo tags, task assignees) in the standard list: search, team filter,
   * sorting, checkboxes. `max` locks further rows once reached.
   */
  let {
    list,
    chosen,
    ontoggle,
    max,
    emptyText = 'Keine passenden Personen.',
  }: { list: PersonListModel; chosen: readonly string[]; ontoggle: (memberId: string) => void; max?: number; emptyText?: string } = $props();

  const check = {
    checked: (p: Person) => chosen.includes(p.memberId),
    toggle: (p: Person) => ontoggle(p.memberId),
    disabled: (p: Person) => max !== undefined && chosen.length >= max && !chosen.includes(p.memberId),
    label: (p: Person) => `${p.name} auswählen`,
  };
</script>

<DataTable model={list} rowKey={(p) => p.memberId} {check} {emptyText}>
  {#snippet actions()}
    <span class="muted count">{chosen.length}{max !== undefined ? ` von ${max}` : ''} ausgewählt</span>
  {/snippet}
</DataTable>

<style>
  .count {
    font-size: var(--font-size-small);
    white-space: nowrap;
  }
</style>
