<script lang="ts">
  import { commands, live, store, windows } from '../../lib/container';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import { onLive } from '../../lib/live/onLive.svelte';
  import Button from '../../ui/Button.svelte';
  import DataTable from '../../ui/DataTable.svelte';
  import Page from '../../ui/Page.svelte';
  import { ITEM_CHANGED } from './events';
  import { InventoryListModel } from './InventoryListModel.svelte';
  import { inventoryApi, inventoryPolicy as policy } from './services';

  const list = new InventoryListModel(inventoryApi, store);
  void list.load();
  onLive(live, ITEM_CHANGED, () => void list.load());
  useCommands(commands, { 'page.new': { run: () => windows.open('item-new', '-'), when: () => policy.canManage() } });
</script>

<Page title="Inventar">
  {#snippet actions()}
    {#if policy.canManage()}
      <Button variant="primary" onclick={() => windows.open('item-new', '-')}>Neuer Gegenstand</Button>
    {/if}
  {/snippet}

  <DataTable
    model={list}
    rowKey={(i) => i.id}
    onopen={(i) => windows.open('item', i.id)}
    selected={windows.current?.kind === 'item' ? windows.current.id : null}
    emptyText="Noch nichts im Inventar."
  />
</Page>
