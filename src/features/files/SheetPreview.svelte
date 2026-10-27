<script lang="ts">
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';
  import { OfficeReader, type Sheet } from './OfficeReader';

  /** Cell values of a workbook, one sheet at a time, with column letters and row numbers. */
  let { sheets }: { sheets: readonly Sheet[] } = $props();

  let chosen = $state<string | null>(null);
  const sheet = $derived(sheets.find((s) => s.name === chosen) ?? sheets[0]);
  const width = $derived(Math.max(1, ...(sheet?.rows.map((r) => r.length) ?? [1])));
</script>

{#if sheets.length > 1}
  <div class="tabs">
    <ChoiceGroup
      name="sheet"
      label="Tabellenblatt"
      size="sm"
      options={sheets.map((s) => ({ value: s.name, label: s.name }))}
      bind:value={() => sheet?.name ?? null, (name) => (chosen = name)}
    />
  </div>
{/if}
{#if sheet && sheet.rows.length}
  <div class="scroll">
    <table>
      <thead>
        <tr>
          <th></th>
          {#each { length: width } as _, column (column)}<th>{OfficeReader.columnName(column)}</th>{/each}
        </tr>
      </thead>
      <tbody>
        {#each sheet.rows as row, index (index)}
          <tr>
            <th>{index + 1}</th>
            {#each { length: width } as _, column (column)}<td>{row[column] ?? ''}</td>{/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{:else}
  <p class="muted empty">Dieses Tabellenblatt ist leer.</p>
{/if}

<style>
  .tabs {
    padding: var(--space-sm) var(--space-sm) 0;
  }
  .scroll {
    max-height: min(70vh, 800px);
    overflow: auto;
  }
  table {
    border-collapse: collapse;
    font-size: var(--font-size-small);
    font-variant-numeric: tabular-nums;
  }
  th,
  td {
    min-width: 4rem;
    max-width: 18rem;
    padding: 4px var(--space-sm);
    overflow: hidden;
    border: 1px solid var(--color-border);
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  td {
    background: var(--color-elevated);
  }
  th {
    position: sticky;
    top: 0;
    background: var(--color-surface);
    color: var(--color-text-muted);
    font-weight: var(--font-weight-medium);
  }
  tbody th {
    left: 0;
    min-width: 2.5rem;
    text-align: right;
  }
  .empty {
    margin: 0;
    padding: var(--space-lg);
  }
</style>
