<script lang="ts">
  import { calendarSources, directory, session, store, windows } from '../../lib/container';
  import DataTable from '../../ui/DataTable.svelte';
  import Page from '../../ui/Page.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { HomeAgendaModel } from './HomeAgendaModel.svelte';

  const DAYS = 7;
  const agenda = new HomeAgendaModel(calendarSources, session.clock, DAYS, () => session.format, directory, store);
  void agenda.load();
  directory.loadRosters();
</script>

<Page title="Hallo {session.member.firstName}">
  {#snippet context()}
    <span class="muted">{session.club?.name}</span>
    {#each session.teams as team (team.id)}<Tag tone="blue">{team.name}</Tag>{/each}
  {/snippet}

  <h2 class="section">Die nächsten {DAYS} Tage</h2>
  <DataTable model={agenda} rowKey={(e) => e.key} onopen={(e) => windows.open(e.window.kind, e.window.id)}
    emptyText="In den nächsten Tagen steht nichts an.">
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
</Page>

<style>
  .section {
    margin-top: 0;
  }
  .inactive {
    color: var(--color-text-muted);
    text-decoration: line-through;
  }
</style>
