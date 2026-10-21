<script lang="ts">
  import { openTab } from '../lib/window/openTab';
  import { settings } from '../settings';
  import { backStack, bus, permissions, session } from '../lib/container';
  import RecordLink from './RecordLink.svelte';
  import { TOAST } from '../channels';
  import { FILES_CHANGED } from '../features/files/events';
  import { ITEM_CHANGED } from '../features/inventory/events';
  import { useBus } from '../lib/bus/useBus.svelte';
  import { LinksModel } from '../lib/links/LinksModel.svelte';
  import { placeName, type FileRef } from '../lib/links/model';
  import Button from './Button.svelte';
  import ErrorNote from './ErrorNote.svelte';
  import SearchSelect from './SearchSelect.svelte';
  import Tag from './Tag.svelte';
  import { tooltip } from './tooltip';
  import { recordDrop } from './recordDrop';

  /**
   * "Benötigt" (inventory items with quantity) and "Dateien" of an appointment or task, shared by
   * both detail views. Deleted items and files stay listed in red under their last name.
   */
  let { model, editable }: { model: LinksModel; editable: boolean } = $props();

  // Renamed or deleted items and files show up without a reload.
  useBus(bus, [ITEM_CHANGED, FILES_CHANGED], () => {
    if (!model.editing && !model.save.busy) void model.load();
  });


  async function download(file: FileRef) {
    try {
      await openTab(model.downloadUrl(file));
    } catch {
      bus.publish(TOAST, { text: 'Die Datei lässt sich gerade nicht öffnen.' });
    }
  }

  async function save() {
    if (await model.commit()) bus.publish(TOAST, { text: 'Benötigt und Dateien gespeichert.' });
  }
  backStack.while(() => model.editing, () => model.cancel());

  // Items and files dragged in from a list, the other pane or a name (record windows: `item`, `folderId:fileId`).
  function dropItem(itemId: string, name: string) {
    model.addItem(itemId);
    if (!model.needs.some((n) => n.itemId === itemId)) bus.publish(TOAST, { text: `„${name}“ ist nicht im Inventar.` });
  }
  async function dropFile(id: string, name: string) {
    if (!(await model.dropFile(id.slice(id.indexOf(':') + 1), name))) bus.publish(TOAST, { text: `„${name}“ lässt sich hier nicht anhängen.` });
  }
</script>

{#if model.editing}
  <div class="stack">
    <div class="stack drop" {@attach recordDrop(['item'], (ref) => dropItem(ref.id, ref.title))}>
      <h2>Benötigt</h2>
      {#if model.needs.length}
        <ul class="entries">
          {#each model.needs as need (need.itemId)}
            {@const error = LinksModel.quantityError(need.quantity)}
            <li class:deleted={need.deleted}>
              <span class="name">
                <!-- Members see what is needed; only admin, board and coaches open the inventory. -->
                <RecordLink kind="item" id={need.itemId} allowed={!need.deleted && permissions.isPrivileged} hint="Gegenstand öffnen">{need.name}</RecordLink>
              </span>
              {#if need.deleted}<Tag tone="danger">Gelöscht</Tag>{:else}<span></span>{/if}
              <input
                class="quantity"
                type="number"
                min="1"
                max={settings.links.maxQuantity}
                aria-label="Menge {need.name}"
                aria-invalid={error !== null}
                bind:value={need.quantity}
              />
              <span class="muted stock">{need.stock !== null ? `von ${need.stock}` : ''}</span>
              <Button size="sm" variant="ghost" onclick={() => model.removeItem(need.itemId)}>Entfernen</Button>
            </li>
          {/each}
        </ul>
      {/if}
      <div class="add">
        <SearchSelect
          search={(q) => model.findItems(q).map((o) => ({ value: o.id, label: o.label }))}
          onpick={(id) => model.addItem(id)}
          placeholder={model.items.loading ? 'Inventar wird geladen' : 'Gegenstand suchen und hinzufügen'}
          emptyText={model.items.value?.length === 0 ? 'Das Inventar ist leer.' : 'Kein passender Gegenstand.'}
          aria-label="Gegenstand hinzufügen"
        />
      </div>
    </div>

    <div class="stack drop" {@attach recordDrop(['file'], (ref) => void dropFile(ref.id, ref.title))}>
      <h2>Dateien</h2>
      {#if model.files.length}
        <ul class="entries">
          {#each model.files as file (file.id)}
            <li class:deleted={file.deleted}>
              <span class="name">{file.name}</span>
              {#if file.deleted}<Tag tone="danger">Gelöscht</Tag>{:else}<span></span>{/if}
              <span></span>
              <span></span>
              <Button size="sm" variant="ghost" onclick={() => model.removeFile(file.id)}>Entfernen</Button>
            </li>
          {/each}
        </ul>
      {/if}
      <div class="add">
        <SearchSelect
          search={async (q) => (await model.findFiles(q)).map((o) => ({ value: o.id, label: o.label }))}
          onpick={(id) => model.addFile(id)}
          debounceMs={settings.links.searchDebounceMs}
          placeholder="Datei suchen und hinzufügen"
          emptyText="Keine passende Datei."
          aria-label="Datei hinzufügen"
        />
      </div>
    </div>

    <ErrorNote error={model.save.error ?? model.items.error} />
    <div class="row">
      <Button variant="primary" busy={model.save.busy} disabled={!model.valid} onclick={save}>Speichern</Button>
      <Button variant="ghost" onclick={() => model.cancel()}>Abbrechen</Button>
    </div>
  </div>
{:else if model.links.value}
  {@const links = model.links.value}
  {#if links.needs.length || editable}
    <h2 class="heading">
      Benötigt
      {#if editable}<Button size="sm" variant="ghost" onclick={() => model.edit()}>Bearbeiten</Button>{/if}
    </h2>
    {#if links.needs.length}
      <ul class="entries">
        {#each links.needs as need (need.itemId)}
          <li class="need" class:deleted={need.deleted}>
            <span class="name">{need.name}</span>
            {#if need.deleted}<Tag tone="danger">Gelöscht</Tag>{:else}<span></span>{/if}
            <!-- Amount, then where the items are, right-aligned below it. -->
            <span class="amount">
              <span>
                <span class="quantity-text">{need.quantity}</span>
                {#if need.stock !== null}<span class="stock" class:short={LinksModel.short(need)}>von {need.stock} im Inventar</span>{/if}
              </span>
              {#if need.places?.length}
                <span class="places muted">
                  {#each need.places as place, i (i)}
                    <span class="place">
                      {#if place.kind === 'LOCATION' && place.id && place.name}<RecordLink kind="location" id={place.id}>{place.name}</RecordLink>
                      {:else if place.kind === 'PERSON' && place.id === session.member.id}<strong>bei dir</strong>
                      {:else if place.kind === 'PERSON' && place.id && place.name}<RecordLink kind="member" id={place.id} allowed={permissions.canSeeMember(place.id)} hint="Profil öffnen">{place.name}</RecordLink>
                      {:else}{placeName(place)}{/if}
                      {place.quantity}
                    </span>
                  {/each}
                </span>
              {/if}
            </span>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="muted none">Nichts eingetragen.</p>
    {/if}
  {/if}
  {#if links.files.length || editable}
    <h2>Dateien</h2>
    {#if links.files.length}
      <ul class="entries">
        {#each links.files as file (file.id)}
          <li class:deleted={file.deleted}>
            {#if file.deleted}
              <span class="name">{file.name}</span>
              <Tag tone="danger">Gelöscht</Tag>
            {:else}
              <span class="name"><RecordLink kind="file" id="{file.folderId}:{file.id}" hint="Vorschau öffnen">{file.name}</RecordLink></span>
              <span></span>
            {/if}
            {#if file.deleted}<span></span>{:else}<Button size="sm" variant="ghost" icon="download" onclick={() => download(file)} tooltip="{file.name} herunterladen" />{/if}
            <span></span>
            <span></span>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="muted none">Keine Dateien.</p>
    {/if}
  {/if}
{:else}
  <ErrorNote error={model.links.error} />
{/if}

<style>
  .heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
  }
  .entries {
    display: grid;
  }
  li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto 5rem minmax(0, 10rem) auto;
    align-items: center;
    gap: var(--space-sm);
    min-height: var(--control-height);
    padding: 2px 0;
    border-bottom: 1px solid var(--color-border);
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .deleted .name {
    color: var(--color-danger);
  }
  .quantity,
  .quantity-text {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .stock {
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
  }
  .stock.short {
    color: var(--color-danger);
  }
  li.need {
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: start;
    padding: var(--space-xxs) 0;
  }
  li.need .name {
    align-self: center;
  }
  .amount {
    display: grid;
    justify-items: end;
    gap: 2px;
    text-align: right;
  }
  .places {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0 var(--space-sm);
    font-size: var(--font-size-small);
  }
  .place + .place::before {
    content: '·';
    margin-right: var(--space-sm);
  }
  .add {
    max-width: var(--layout-field-width);
  }
  .drop {
    border-radius: var(--radius-md);
  }
  .none {
    margin: 0;
  }
</style>
