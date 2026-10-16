<script lang="ts">
  import { bus, session } from '../../lib/container';
  import { CONFIRM, TOAST, WINDOW_OPEN } from '../../channels';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import { Action } from '../../lib/state/Action.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import Detail from '../../ui/Detail.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { tooltip } from '../../ui/tooltip';
  import { APPOINTMENTS_CHANGED } from '../calendar/events';
  import { TASK_CHANGED } from '../tasks/events';
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
  // svelte-ignore state_referenced_locally
  const uses = new Resource(() => inventoryApi.uses(id));
  void item.load();
  void uses.load();

  // Lists elsewhere change what needs this item.
  useBus(bus, [APPOINTMENTS_CHANGED, TASK_CHANGED], () => void uses.load());

  $effect(() => {
    const name = item.value?.name;
    if (name) handle?.setTitle(name);
  });

  useBus(bus, ITEM_CHANGED, ({ data }) => {
    if (data.itemId !== id || save.busy || remove.busy) return;
    if (data.change === 'DELETED') {
      bus.publish(TOAST, { text: 'Dieser Gegenstand wurde gelöscht.' });
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
      bus.publish(TOAST, { text: 'Gegenstand gespeichert.' });
    }
  }

  async function destroy(name: string) {
    const ok = await bus.request(CONFIRM, {
      title: 'Gegenstand löschen',
      message: `„${name}“ wird aus dem Inventar gelöscht. Termine und Aufgaben, die ihn benötigen, zeigen ihn weiter als gelöscht an.`,
      confirmLabel: 'Löschen',
      danger: true,
    });
    if (ok && (await remove.run(() => inventoryApi.delete(id)))) {
      bus.publish(TOAST, { text: 'Gegenstand gelöscht.' });
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

        <h2>Benötigt für</h2>
        <AsyncView resource={uses}>
          {#snippet children(list)}
            {#if list.length}
              <ul class="uses">
                {#each list as use (use.kind + use.id)}
                  <li>
                    <button type="button" onclick={() => bus.publish(WINDOW_OPEN, { kind: use.kind === 'APPOINTMENT' ? 'appointment' : 'task', id: use.id })}
                      {@attach tooltip(use.kind === 'APPOINTMENT' ? 'Termin öffnen' : 'Aufgabe öffnen')}>
                      <span class="title">{use.title}</span>
                      <span class="muted">{use.kind === 'APPOINTMENT' ? 'Termin' : 'Aufgabe'}{use.at ? `, ${session.format.dateTime(use.at)}` : ''}</span>
                      <span class="quantity" class:short={use.quantity > value.quantity}>{use.quantity}</span>
                    </button>
                  </li>
                {/each}
              </ul>
            {:else}
              <p class="muted none">Kein kommender Termin und keine offene Aufgabe braucht diesen Gegenstand.</p>
            {/if}
          {/snippet}
        </AsyncView>
      {/if}
    </Detail>
  {/snippet}
</AsyncView>

<style>
  .uses li {
    border-bottom: 1px solid var(--color-border);
  }
  .uses button {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto 4rem;
    align-items: center;
    gap: var(--space-md);
    width: 100%;
    min-height: var(--control-height);
    padding: 2px var(--space-xs);
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    text-align: left;
    cursor: pointer;
  }
  .uses button:hover {
    background: var(--color-hover);
  }
  .title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .quantity {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .short {
    color: var(--color-danger);
  }
  .none {
    margin: 0;
  }
</style>
