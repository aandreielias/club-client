<script lang="ts">
  import { bus, commands, router, store, windows } from '../../lib/container';
  import { WINDOW_OPEN } from '../../channels';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import Button from '../../ui/Button.svelte';
  import DataTable from '../../ui/DataTable.svelte';
  import { windowMenu } from '../../lib/window/windowMenu';

  import Page from '../../ui/Page.svelte';
  import { ITEM_CHANGED } from './events';
  import { InventoryListModel } from './InventoryListModel.svelte';
  import { inventoryApi, inventoryPolicy as policy } from './services';

  const list = new InventoryListModel(inventoryApi, store);
  void list.load();
  useBus(bus, ITEM_CHANGED, () => void list.load());
  useCommands(commands, { 'page.new': { run: () => bus.publish(WINDOW_OPEN, { kind: 'item-new', id: '-' }), when: () => policy.canManage() } });
</script>

<Page title="Inventar">
  {#snippet actions()}
    {#if policy.canManage()}
      <Button variant="primary" onclick={() => bus.publish(WINDOW_OPEN, { kind: 'item-new', id: '-' })}>Neuer Gegenstand</Button>
    {/if}
  {/snippet}

  <DataTable
    model={list}
    rowKey={(i) => i.id}
    onopen={(i) => bus.publish(WINDOW_OPEN, { kind: 'item', id: i.id })}
    menu={(i) => windowMenu(bus, windows, router, 'item', i.id)}
    selected={windows.current?.kind === 'item' ? windows.current.id : null}
    emptyText="Noch nichts im Inventar."
  />
</Page>
