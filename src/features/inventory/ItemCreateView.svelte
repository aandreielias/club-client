<script lang="ts">
  import { toasts } from '../../lib/container';
  import { Action } from '../../lib/state/Action.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import Detail from '../../ui/Detail.svelte';
  import { ItemForm } from './ItemForm.svelte';
  import ItemEditor from './ItemEditor.svelte';
  import { InventoryListModel } from './InventoryListModel.svelte';
  import { inventoryApi } from './services';

  /** New inventory item in the window; afterwards the window shows the item. */
  let { handle }: { id: string; handle: WindowHandle } = $props();

  const form = ItemForm.blank();
  const save = new Action();
  let categories = $state<string[]>([]);
  inventoryApi.list().then((items) => (categories = InventoryListModel.categories(items)), () => {});

  $effect(() => handle.setTitle('Neuer Gegenstand'));

  async function submit() {
    let created = '';
    if (await save.run(async () => (created = (await inventoryApi.create(form.toNew())).id))) {
      toasts.show('Gegenstand angelegt.');
      handle.open('item', created);
    }
  }
</script>

<Detail title="Neuer Gegenstand">
  <ItemEditor {form} action={save} {categories} submitLabel="Anlegen" oncancel={() => handle.close()} onsubmit={submit} />
</Detail>
