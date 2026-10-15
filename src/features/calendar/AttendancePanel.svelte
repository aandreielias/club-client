<script lang="ts">
  import { session, store } from '../../lib/container';
  import DataTable from '../../ui/DataTable.svelte';
  import Tag from '../../ui/Tag.svelte';
  import type { AppointmentDetailModel } from './AppointmentDetailModel.svelte';
  import { AttendanceListModel } from './AttendanceListModel.svelte';
  import { responseHue, responseLabel, type Attendance } from './model';

  /** Answer counts plus the list of entries (reasons only where the server sends them). */
  let { attendance, detail }: { attendance: Attendance; detail: AppointmentDetailModel } = $props();

  const list = new AttendanceListModel(
    async () => detail.attendance.value?.entries ?? [],
    () => session.format,
    store,
  );

  $effect(() => list.set(attendance.entries));

  const summary = $derived([
    { label: 'Zusagen', count: attendance.yes, hue: 'green' as const },
    { label: 'Vielleicht', count: attendance.maybe, hue: 'yellow' as const },
    { label: 'Absagen', count: attendance.no, hue: 'red' as const },
    { label: 'Offen', count: attendance.open, hue: 'gray' as const },
  ]);
</script>

<dl class="summary">
  {#each summary as item (item.label)}
    <div style:--hue="var(--color-tag-{item.hue}-text)">
      <dt>{item.label}</dt>
      <dd>{item.count}</dd>
    </div>
  {/each}
</dl>

<DataTable model={list} rowKey={(e) => e.memberId} emptyText="Noch keine Antworten.">
  {#snippet cell(entry, column)}
    {#if column.key === 'status'}
      <Tag tone={responseHue(entry.status)}>{responseLabel(entry.status)}</Tag>
    {:else if column.key === 'reason'}
      <span class="muted">{entry.reason ?? ''}</span>
    {:else}
      {list.display(entry, column)}
    {/if}
  {/snippet}
</DataTable>

<style>
  .summary {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xl);
    margin: 0 0 var(--space-md);
  }
  .summary dt {
    color: var(--color-text-muted);
    font-size: var(--font-size-small);
  }
  .summary dd {
    margin: 0;
    color: var(--hue);
    font-size: var(--font-size-h2);
    font-weight: var(--font-weight-bold);
    font-variant-numeric: tabular-nums;
  }
</style>
