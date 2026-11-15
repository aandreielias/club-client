<script lang="ts">
  import { recordMenu } from '../../ui/contextMenu';
  import { settings } from '../../settings';
  import { bus } from '../../lib/container';
  import { WINDOW_OPEN } from '../../channels';
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
  menu={(i) => recordMenu('item', i.id)}
  emptyText="Noch nichts im Inventar."
/>
