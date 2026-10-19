<script lang="ts">
  import { bus, commands, directory, permissions, router, session, store, windows } from '../../lib/container';
  import { WINDOW_OPEN } from '../../channels';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import { windowMenu } from '../../lib/window/windowMenu';
  import Button from '../../ui/Button.svelte';
  import DataTable from '../../ui/DataTable.svelte';
  import Page from '../../ui/Page.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { APPOINTMENTS_CHANGED } from './events';
  import { EventListModel } from './EventListModel.svelte';
  import { typeHue } from './model';
  import { appointmentPolicy as policy, calendarApi } from './services';

  const list = new EventListModel(calendarApi, session.clock, () => session.format, directory, store);
  void list.load();
  directory.loadRosters();
  if (permissions.isManager) directory.loadTeams().catch(() => {});
  useBus(bus, APPOINTMENTS_CHANGED, () => void list.load());

  const create = () => bus.publish(WINDOW_OPEN, { kind: 'appointment-new', id: '-' });
  useCommands(commands, { 'page.new': { run: create, when: () => policy.canCreate() } });
</script>

<Page title="Events">
  {#snippet actions()}
    {#if policy.canCreate()}<Button variant="primary" icon="add" onclick={create}>Neuer Termin</Button>{/if}
  {/snippet}

  <DataTable
    model={list}
    rowKey={(a) => a.id}
    record={(a) => ({ kind: 'appointment', id: a.id, title: a.title })}
    onopen={(a) => bus.publish(WINDOW_OPEN, { kind: 'appointment', id: a.id })}
    menu={(a) => windowMenu(bus, windows, router, 'appointment', a.id)}
    selected={windows.current?.kind === 'appointment' ? windows.current.id : null}
    emptyText={list.filters.past ? 'Keine vergangenen Termine im letzten Jahr.' : 'Keine Termine im kommenden Jahr.'}
    emptyAction={policy.canCreate() ? { label: 'Neuer Termin', icon: 'add', run: create } : null}
  >
    {#snippet cell(a, column)}
      {#if column.key === 'title'}
        <span class:cancelled={a.cancelled}>{a.title}</span>
      {:else if column.key === 'type'}
        <Tag tone={a.cancelled ? 'gray' : typeHue(a.type)}>{a.cancelled ? 'Abgesagt' : list.display(a, column)}</Tag>
      {:else}
        {list.display(a, column)}
      {/if}
    {/snippet}
  </DataTable>
</Page>

<style>
  .cancelled {
    color: var(--color-text-muted);
    text-decoration: line-through;
  }
</style>
