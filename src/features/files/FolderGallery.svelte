<script lang="ts">
  import AsyncView from '../../ui/AsyncView.svelte';
  import Empty from '../../ui/Empty.svelte';
  import ListToolbar from '../../ui/ListToolbar.svelte';
  import type { FolderItem, FolderItemListModel } from './FolderItemListModel.svelte';
  import Thumbnail from './Thumbnail.svelte';

  /** Gallery view of the same list model as the table: tiles for folders, photos and documents. */
  let { model, onopen }: { model: FolderItemListModel; onopen: (item: FolderItem) => void } = $props();
</script>

<div class="gallery">
  <ListToolbar {model} />
  <AsyncView resource={model.data}>
    {#snippet children()}
      {#if model.rows.length}
        <ul class="tiles">
          {#each model.rows as item (item.id)}
            <li>
              <button class="tile" onclick={() => onopen(item)} aria-label={item.kind === 'folder' ? `Ordner ${item.name} öffnen` : `${item.name} öffnen`}>
                <span class="preview">
                  {#if item.kind === 'file'}
                    <Thumbnail file={item.file} />
                  {:else}
                    <span class="folder muted">Ordner</span>
                  {/if}
                </span>
                <span class="name">{item.name}</span>
              </button>
            </li>
          {/each}
        </ul>
      {:else}
        <Empty text={model.total ? 'Keine Einträge passen zu Suche und Filtern.' : 'Noch nichts hochgeladen.'} />
      {/if}
    {/snippet}
  </AsyncView>
</div>

<style>
  .gallery {
    display: grid;
    gap: var(--space-md);
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
    gap: var(--space-md);
  }
  .tile {
    display: grid;
    width: 100%;
    padding: 0;
    overflow: hidden;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-background);
    text-align: left;
    cursor: pointer;
    transition: box-shadow var(--motion-fast);
  }
  .tile:hover {
    box-shadow: var(--color-shadow-popover);
  }
  .preview {
    display: block;
    aspect-ratio: 4 / 3;
    background: var(--color-surface);
  }
  .folder {
    display: grid;
    place-items: center;
    height: 100%;
    font-size: var(--font-size-small);
  }
  .name {
    padding: var(--space-xs) var(--space-sm);
    overflow: hidden;
    border-top: 1px solid var(--color-border);
    font-size: var(--font-size-small);
    font-weight: var(--font-weight-medium);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
