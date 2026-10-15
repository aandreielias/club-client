<script lang="ts">
  import { confirmation, live, session, toasts } from '../../lib/container';
  import { onLive } from '../../lib/live/onLive.svelte';
  import { Action } from '../../lib/state/Action.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import Detail from '../../ui/Detail.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { ITEM_CHANGED, type ItemChanged } from './events';
  import { ItemForm } from './ItemForm.svelte';
  import ItemEditor from './ItemEditor.svelte';
  import { inventoryApi, inventoryPolicy as policy } from './services';

  /** One inventory item; edit and delete for admin, board and coaches. Window and page. */
  let { id, handle, onclosed }: { id: string; handle?: WindowHandle; onclosed?: () => void } = $props();

  // svelte-ignore state_referenced_locally
  const item = new Resource(() => inventoryApi.get(id));
  const save = new Action();
  const remove = new Action();
  let form = $state<ItemForm | null>(null);
  void item.load();

  $effect(() => {
    const name = item.value?.name;
    if (name) handle?.setTitle(name);
  });

  onLive<ItemChanged>(live, ITEM_CHANGED, ({ data }) => {
    if (data.itemId !== id || save.busy || remove.busy) return;
    if (data.change === 'DELETED') {
      toasts.show('Dieser Gegenstand wurde gelöscht.');
      leave();
    } else if (!form) {
      void item.load();
    }
  });

  function leave() {
    if (handle) handle.close();
    else onclosed?.();
  }

  async function submit(value: ItemForm) {
    let updated = null;
    if (await save.run(async () => (updated = await inventoryApi.update(id, value.toPatch())))) {
      if (updated) item.set(updated);
      form = null;
      toasts.show('Gegenstand gespeichert.');
    }
  }

  async function destroy(name: string) {
    const ok = await confirmation.ask({
      title: 'Gegenstand löschen',
      message: `„${name}“ wird aus dem Inventar gelöscht. Termine und Aufgaben, die ihn benötigen, zeigen ihn weiter als gelöscht an.`,
      confirmLabel: 'Löschen',
      danger: true,
    });
    if (ok && (await remove.run(() => inventoryApi.delete(id)))) {
      toasts.show('Gegenstand gelöscht.');
      leave();
    }
  }
</script>

<AsyncView resource={item}>
  {#snippet children(value)}
    <Detail title={form ? 'Gegenstand bearbeiten' : value.name}>
      {#snippet actions()}
        {#if !form && policy.canManage()}
          <Button onclick={() => (form = ItemForm.edit(value))}>Bearbeiten</Button>
          <Button variant="danger" busy={remove.busy} onclick={() => destroy(value.name)}>Löschen</Button>
        {/if}
      {/snippet}
      {#snippet meta()}
        {#if !form && value.category}<Tag tone="gray">{value.category}</Tag>{/if}
      {/snippet}

      {#if form}
        <ItemEditor {form} action={save} submitLabel="Speichern" oncancel={() => (form = null)} onsubmit={() => form && submit(form)} />
      {:else}
        <ErrorNote error={remove.error} />
        <dl class="props">
          <dt>Bestand</dt>
          <dd>{value.quantity}</dd>
          <dt>Ort</dt>
          <dd>{value.location ?? '–'}</dd>
          <dt>Geändert</dt>
          <dd>{session.format.dateTime(value.updatedAt)}</dd>
        </dl>
        {#if value.description}<p class="prose">{value.description}</p>{/if}
      {/if}
    </Detail>
  {/snippet}
</AsyncView>
