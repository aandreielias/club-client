<script lang="ts">
  import { bus, commands, permissions, router, store, windows } from '../../lib/container';
  import { WINDOW_OPEN } from '../../channels';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import { windowMenu } from '../../lib/window/windowMenu';
  import Button from '../../ui/Button.svelte';
  import DataTable from '../../ui/DataTable.svelte';
  import Page from '../../ui/Page.svelte';
  import { LOCATION_CHANGED } from './events';
  import { LocationListModel } from './LocationListModel.svelte';
  import { locationsApi } from './services';

  const list = new LocationListModel(locationsApi, store);
  void list.load();
  useBus(bus, LOCATION_CHANGED, () => void list.load());
  const create = () => bus.publish(WINDOW_OPEN, { kind: 'location-new', id: '-' });
  useCommands(commands, { 'page.new': { run: create, when: () => permissions.isPrivileged } });
</script>

<Page title="Orte">
  {#snippet actions()}
    {#if permissions.isPrivileged}<Button variant="primary" icon="add" onclick={create}>Neuer Ort</Button>{/if}
  {/snippet}

  <DataTable
    model={list}
    rowKey={(l) => l.id}
    record={(l) => ({ kind: 'location', id: l.id, title: l.name })}
    onopen={(l) => bus.publish(WINDOW_OPEN, { kind: 'location', id: l.id })}
    menu={(l) => windowMenu(bus, windows, router, 'location', l.id)}
    selected={windows.current?.kind === 'location' ? windows.current.id : null}
    emptyText="Noch keine Orte eingetragen."
    emptyAction={permissions.isPrivileged ? { label: 'Neuer Ort', icon: 'add', run: create } : null}
  />
</Page>
