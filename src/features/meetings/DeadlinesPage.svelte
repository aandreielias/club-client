<script lang="ts">
  import { bus, calendarSources, router, session, store, windows } from '../../lib/container';
  import { NAVIGATE, WINDOW_OPEN } from '../../channels';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import type { CalendarEntry } from '../../lib/calendar/CalendarSources';
  import { windowMenu } from '../../lib/window/windowMenu';
  import DataTable from '../../ui/DataTable.svelte';
  import Page from '../../ui/Page.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { DeadlineListModel } from './DeadlineListModel.svelte';
  import { MEETING_CHANGED } from './events';

  /** Fristen: meetings, invitation deadlines, circular votes, term ends and follow-up tasks in one list (the calendar's items). */
  const list = new DeadlineListModel(calendarSources, () => session.clock, store);
  void list.load();
  useBus(bus, MEETING_CHANGED, () => void list.load());

  function open(e: CalendarEntry) {
    if (e.window) bus.publish(WINDOW_OPEN, { kind: e.window.kind, id: e.window.id });
    else if (e.path) bus.publish(NAVIGATE, { path: e.path });
  }
</script>

<Page title="Fristen">
  <DataTable
    model={list}
    rowKey={(e) => e.key}
    record={(e) => (e.window ? { ...e.window, title: e.title } : null)}
    onopen={open}
    menu={(e) => (e.window ? windowMenu(bus, windows, router, e.window.kind, e.window.id) : [])}
    selected={windows.current ? (list.rows.find((e) => e.window?.kind === windows.current?.kind && e.window?.id === windows.current?.id)?.key ?? null) : null}
    emptyText={list.filters.past ? 'Nichts im letzten Jahr.' : 'Keine Sitzungen oder Fristen in den nächsten drei Jahren.'}
  >
    {#snippet cell(e, column)}
      {#if column.key === 'kind'}
        <Tag tone={e.hue}>{e.label}</Tag>
      {:else if column.key === 'title'}
        <span class:done={e.inactive}>{e.title}</span>
      {:else}
        {list.display(e, column)}
      {/if}
    {/snippet}
  </DataTable>
</Page>

<style>
  .done {
    color: var(--color-text-muted);
    text-decoration: line-through;
  }
</style>
