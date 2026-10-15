<script lang="ts">
  import { settings } from '../settings';
  import { live, toasts } from '../lib/container';
  import { onLive } from '../lib/live/onLive.svelte';
  import { LinksModel } from '../lib/links/LinksModel.svelte';
  import type { FileRef } from '../lib/links/model';
  import Button from './Button.svelte';
  import ErrorNote from './ErrorNote.svelte';
  import SearchSelect from './SearchSelect.svelte';
  import Tag from './Tag.svelte';
  import { tooltip } from './tooltip';

  /**
   * "Benötigt" (inventory items with quantity) and "Dateien" of an appointment or task, shared by
   * both detail views. Deleted items and files stay listed in red under their last name.
   */
  let { model, editable }: { model: LinksModel; editable: boolean } = $props();

  // Renamed or deleted items and files show up without a reload.
  onLive(live, ['inventory.item-changed', 'files.files-changed'], () => {
    if (!model.editing && !model.save.busy) void model.load();
  });


  async function download(file: FileRef) {
    try {
      window.open(await model.downloadUrl(file), '_blank', 'noopener');
    } catch {
      toasts.show('Die Datei lässt sich gerade nicht öffnen.');
    }
  }

  async function save() {
    if (await model.commit()) toasts.show('Benötigt und Dateien gespeichert.');
  }
</script>

{#if model.editing}
  <div class="stack">
    <h2>Benötigt</h2>
    {#if model.needs.length}
      <ul class="entries">
        {#each model.needs as need (need.itemId)}
          {@const error = LinksModel.quantityError(need.quantity)}
          <li class:deleted={need.deleted}>
            <span class="name">{need.name}</span>
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
          <li class:deleted={need.deleted}>
            <span class="name">{need.name}</span>
            {#if need.deleted}<Tag tone="danger">Gelöscht</Tag>{:else}<span></span>{/if}
            <span class="quantity-text">{need.quantity}</span>
            <span class="stock" class:short={LinksModel.short(need)}>
              {#if need.stock !== null}von {need.stock} im Inventar{/if}
            </span>
            <span></span>
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
              <button type="button" class="name link" onclick={() => download(file)} {@attach tooltip(`${file.name} herunterladen`)}>{file.name}</button>
              <span></span>
            {/if}
            <span></span>
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
  .link {
    padding: 0;
    border: 0;
    background: none;
    text-align: left;
    text-decoration: underline;
    text-decoration-color: var(--color-border-strong);
    text-underline-offset: 3px;
    cursor: pointer;
  }
  .link:hover {
    text-decoration-color: currentColor;
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
  .add {
    max-width: var(--layout-field-width);
  }
  .none {
    margin: 0;
  }
</style>
