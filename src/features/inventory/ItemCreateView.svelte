<script lang="ts">
  import { bus } from '../../lib/container';
  import { CreateController } from '../../lib/detail/CreateController.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import Detail from '../../ui/Detail.svelte';
  import { ItemForm } from './ItemForm.svelte';
  import ItemEditor from './ItemEditor.svelte';
  import { InventoryListModel } from './InventoryListModel.svelte';
  import { inventoryApi } from './services';

  /** New inventory item in the window; afterwards the window shows the item. */
  let { handle }: { id: string; handle: WindowHandle } = $props();

  const form = ItemForm.blank();
  // svelte-ignore state_referenced_locally
  const create = new CreateController(bus, handle, 'Neuer Gegenstand');
  let categories = $state<string[]>([]);
  inventoryApi.list().then(
    (items) => (categories = InventoryListModel.categories(items)),
    () => {},
  );

  const submit = () => create.submit(async () => (await inventoryApi.create(form.toNew())).id, 'item', 'Gegenstand angelegt.');
</script>

<Detail title="Neuer Gegenstand">
  <ItemEditor {form} action={create.save} {categories} submitLabel="Anlegen" oncancel={() => handle.close()} onsubmit={submit} />
</Detail>
