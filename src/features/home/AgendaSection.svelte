<script lang="ts">
  import { settings } from '../../settings';
  import { bus, calendarSources, directory, router, session, store, windows } from '../../lib/container';
  import { WINDOW_OPEN } from '../../channels';
  import { windowMenu } from '../../lib/window/windowMenu';
  import DataTable from '../../ui/DataTable.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { HomeAgendaModel } from './HomeAgendaModel.svelte';

  /** Start page section: appointments and due tasks of the next days. */
  const DAYS = settings.home.agendaDays;
  const agenda = new HomeAgendaModel(calendarSources, session.clock, DAYS, () => session.format, directory, store);
  void agenda.load();
  directory.loadRosters();
</script>

<h2>Die nächsten {DAYS} Tage</h2>
<DataTable model={agenda} rowKey={(e) => e.key} onopen={(e) => bus.publish(WINDOW_OPEN, { kind: e.window.kind, id: e.window.id })}
  menu={(e) => windowMenu(bus, windows, router, e.window.kind, e.window.id)} emptyText="In den nächsten Tagen steht nichts an.">
  {#snippet cell(entry, column)}
    {#if column.key === 'label'}
      <Tag tone={entry.hue}>{entry.label}</Tag>
    {:else if column.key === 'title'}
      <span class:inactive={entry.inactive}>{entry.title}</span>
    {:else}
      {agenda.display(entry, column)}
    {/if}
  {/snippet}
</DataTable>

<style>
  .inactive {
    color: var(--color-text-muted);
    text-decoration: line-through;
  }
</style>
