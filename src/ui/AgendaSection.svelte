<script lang="ts">
  import { bus, calendarSources, directory, router, session, windows } from '../lib/container';
  import { WINDOW_OPEN } from '../channels';
  import { AgendaListModel } from '../lib/calendar/AgendaListModel.svelte';
  import { windowMenu } from '../lib/window/windowMenu';
  import DataTable from './DataTable.svelte';
  import SectionHeading from './SectionHeading.svelte';
  import Tag from './Tag.svelte';

  /** Start page section: the next days from the calendar (all sources, or one such as appointments). */
  let { id, title, days, source, href, limit }: { id: string; title: string; days: number; source?: string; href?: string; limit?: number } = $props();

  // svelte-ignore state_referenced_locally
  const agenda = new AgendaListModel(calendarSources, session.clock, { id, days, source }, () => session.format, directory, null);
  void agenda.load();
  directory.loadRosters();
</script>

<SectionHeading {title} {href} />
<DataTable model={agenda} toolbar={false} {limit} rowKey={(e) => e.key} onopen={(e) => bus.publish(WINDOW_OPEN, { kind: e.window.kind, id: e.window.id })}
  menu={(e) => windowMenu(bus, windows, router, e.window.kind, e.window.id)} emptyText="In dieser Zeit steht nichts an.">
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
