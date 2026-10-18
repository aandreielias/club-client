<script lang="ts">
  import { backStack, bus, pendingDeletes, permissions, session } from '../../lib/container';
  import { DetailController, EditSession } from '../../lib/detail/DetailController.svelte';
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
  import { ITEM_CHANGED } from './events';
  import { ItemForm } from './ItemForm.svelte';
  import ItemEditor from './ItemEditor.svelte';
  import Icon from '../../ui/Icon.svelte';
  import RecordLink from '../../ui/RecordLink.svelte';
  import { placeName } from './model';
  import StockEditor from './StockEditor.svelte';
  import { StockForm } from './StockForm.svelte';
  import { inventoryApi, inventoryPolicy as policy } from './services';

  /** One inventory item; edit and delete for admin, board and coaches. Window and page. */
  let { id, handle, onclosed }: { id: string; handle?: WindowHandle; onclosed?: () => void } = $props();

  // svelte-ignore state_referenced_locally
  const view = new DetailController(bus, handle, onclosed);
  const edit = new EditSession<ItemForm>(bus, backStack);
  const stockEdit = new EditSession<StockForm>(bus, backStack);
  const remove = new Action();
  // svelte-ignore state_referenced_locally
  const item = new Resource(() => inventoryApi.get(id));
  // svelte-ignore state_referenced_locally
  const uses = new Resource(() => inventoryApi.uses(id));
  void item.load();
  void uses.load();

  view.title(() => item.value?.name);
  // Lists elsewhere change what needs this item.
  useBus(bus, [APPOINTMENTS_CHANGED, TASK_CHANGED], () => void uses.load());
  view.watch(ITEM_CHANGED, (data) => data.itemId === id, {
    deleted: 'Dieser Gegenstand wurde gelöscht.',
    busy: () => edit.save.busy || stockEdit.save.busy || remove.busy,
    changed: () => !edit.editing && !stockEdit.editing && void item.load(),
  });

  async function submit() {
    // The answer is the saved item, so no reload is needed.
    await edit.submit(async (form) => item.set(await inventoryApi.update(id, form.toPatch())), 'Gegenstand gespeichert.');
  }

  async function submitStock() {
    await stockEdit.submit(async (form) => item.set(await inventoryApi.setStock(id, form.toInput())), 'Bestand gespeichert.');
  }

  /** Termine und Aufgaben, die ihn benötigen, zeigen ihn danach als gelöscht an. */
  function destroy(name: string) {
    pendingDeletes.schedule({ ids: [id], text: `„${name}“ gelöscht.`, commit: () => inventoryApi.delete(id) });
    view.leave();
  }
</script>

<AsyncView resource={item}>
  {#snippet children(value)}
    <Detail title={edit.form ? 'Gegenstand bearbeiten' : value.name}>
      {#snippet actions()}
        {#if !edit.form && policy.canManage()}
          <Button icon="edit" onclick={() => edit.edit(ItemForm.edit(value))}>Bearbeiten</Button>
          <Button variant="danger" icon="delete" busy={remove.busy} onclick={() => destroy(value.name)}>Löschen</Button>
        {/if}
      {/snippet}
      {#snippet meta()}
        {#if !edit.form && value.category}<Tag tone="gray">{value.category}</Tag>{/if}
      {/snippet}

      {#if edit.form}
        <div class="editing" {@attach edit.track}>
          <ItemEditor form={edit.form} action={edit.save} submitLabel="Speichern" oncancel={() => edit.cancel()} onsubmit={submit} />
        </div>
      {:else}
        <ErrorNote error={remove.error} />
        <dl class="props">
          <dt>Bestand</dt>
          <dd>{value.quantity}</dd>
          <dt>Geändert</dt>
          <dd>{session.format.dateTime(value.updatedAt)}</dd>
        </dl>
        {#if value.description}<p class="prose">{value.description}</p>{/if}

        <h2 class="heading">
          Wo ist es?
          {#if !stockEdit.form && policy.canManage()}
            <Button size="sm" variant="ghost" onclick={() => stockEdit.edit(new StockForm(value.stock))} tooltip="Auf Orte und Personen verteilen">Bearbeiten</Button>
          {/if}
        </h2>
        {#if stockEdit.form}
          <div class="editing" {@attach stockEdit.track}>
            <StockEditor form={stockEdit.form} action={stockEdit.save} oncancel={() => stockEdit.cancel()} onsubmit={submitStock} />
          </div>
        {:else if value.stock.length}
          <ul class="stock">
            {#each value.stock as place, i (i)}
              <li>
                <Icon name={place.kind === 'PERSON' ? 'account' : 'location'} small />
                {#if place.kind === 'LOCATION' && place.id && place.name}
                  <RecordLink kind="location" id={place.id}>{place.name}</RecordLink>
                {:else if place.kind === 'PERSON' && place.id && place.name}
                  <RecordLink kind="member" id={place.id} allowed={permissions.canSeeMember(place.id)}>{place.name}</RecordLink>
                {:else}
                  <span class:muted={place.kind === 'NONE'} class:inactive={place.kind !== 'NONE'}>{placeName(place)}</span>
                {/if}
                <span class="count">{place.quantity}</span>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="muted none">Kein Bestand.</p>
        {/if}

        <h2>Benötigt für</h2>
        <AsyncView resource={uses}>
          {#snippet children(list)}
            {#if list.length}
              <ul class="uses">
                {#each list as use (use.kind + use.id)}
                  <li>
                    <button type="button" onclick={() => view.open(use.kind === 'APPOINTMENT' ? 'appointment' : 'task', use.id)}
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
  .editing {
    display: contents;
  }
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
  .heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
  }
  .stock {
    display: grid;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .stock li {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) 4rem;
    align-items: center;
    gap: var(--space-sm);
    min-height: var(--control-height);
    padding: 2px var(--space-xs);
    border-bottom: 1px solid var(--color-border);
  }
  .count {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .inactive {
    color: var(--color-danger);
  }
  .none {
    margin: 0;
  }
</style>
