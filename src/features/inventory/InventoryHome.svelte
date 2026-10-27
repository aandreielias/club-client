<script lang="ts">
  import { settings } from '../../settings';
  import { bus, router, windows } from '../../lib/container';
  import { WINDOW_OPEN } from '../../channels';
  import { windowMenu } from '../../lib/window/windowMenu';
  import DataTable from '../../ui/DataTable.svelte';
  import SectionHeading from '../../ui/SectionHeading.svelte';
  import { InventoryListModel } from './InventoryListModel.svelte';
  import { inventoryApi } from './services';

  /** Start page section (admin, board, coaches): the inventory with stock and place. */
  const list = new InventoryListModel(inventoryApi, null);
  void list.load();
</script>

<SectionHeading title="Inventar" href="#/inventory" />
<DataTable
  model={list}
  toolbar={false}
  limit={settings.home.listRows}
  rowKey={(i) => i.id}
  onopen={(i) => bus.publish(WINDOW_OPEN, { kind: 'item', id: i.id })}
  menu={(i) => windowMenu(bus, windows, router, 'item', i.id)}
  emptyText="Noch nichts im Inventar."
/>
