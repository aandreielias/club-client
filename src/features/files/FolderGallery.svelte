<script lang="ts">
  import { tooltip } from '../../ui/tooltip';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Empty, { type EmptyAction } from '../../ui/Empty.svelte';
  import ListToolbar from '../../ui/ListToolbar.svelte';
  import type { FolderItem, FolderItemListModel } from './FolderItemListModel.svelte';
  import Thumbnail from './Thumbnail.svelte';
  import { pendingDeletes } from '../../lib/container';
  import { menu as contextMenu } from '../../ui/contextMenu';
  import type { MenuEntry } from '../../lib/overlay/ContextMenuService.svelte';
  import CoverImage from './CoverImage.svelte';
  import Icon from '../../ui/Icon.svelte';
  import { colorHue } from './model';
  import { RowDragging, type RowDrag } from '../../ui/rowDrag';
  import { RecordDrag, type RecordRef } from '../../lib/records/RecordDrag';
  import { recordDrop } from '../../ui/recordDrop';

  /** Gallery view of the same list model as the table: tiles for folders, photos and documents. */
  let {
    model,
    onopen,
    menu,
    emptyText = 'Noch nichts hochgeladen.',
    emptyAction,
    selected,
    onselect,
    drag,
    record,
    tagDrop,
  }: {
    model: FolderItemListModel;
    onopen: (item: FolderItem) => void;
    menu?: (item: FolderItem) => readonly MenuEntry[];
    emptyText?: string;
    emptyAction?: EmptyAction | null;
    /** File tiles get a checkbox when given. */
    selected?: (item: FolderItem) => boolean;
    onselect?: (item: FolderItem) => void;
    drag?: RowDrag<FolderItem>;
    /** The record a tile stands for, to drag it onto a message or Benötigt. */
    record?: (item: FolderItem) => RecordRef | null;
    /** Photos that take a dragged member (opens the photo with them in its tag editor). */
    tagDrop?: { accepts: (item: FolderItem) => boolean; drop: (item: FolderItem, memberId: string) => void };
  } = $props();

  function dragStart(item: FolderItem, event: DragEvent) {
    if (drag) RowDragging.start(drag, item, event);
    const ref = record?.(item);
    if (ref) RecordDrag.set(event, ref);
  }

  let dropId = $state<string | null>(null);
</script>

<div class="gallery">
  <ListToolbar {model} />
  <AsyncView resource={model.data}>
    {#snippet children()}
      {#if model.rows.some((item) => !pendingDeletes.isHidden(item.id))}
        <ul class="tiles">
          {#each model.rows.filter((item) => !pendingDeletes.isHidden(item.id)) as item (item.id)}
            <li class="cell" class:chosen={selected?.(item)} class:drop-target={dropId === item.id}
              class:movable={!!drag?.can(item)}
              draggable={drag?.can(item) || record?.(item) ? 'true' : undefined}
              ondragstart={(e) => dragStart(item, e)}
              {@attach recordDrop(['member'], (ref) => tagDrop?.drop(item, ref.id), () => !!tagDrop?.accepts(item))}
              ondragover={(e) => drag && RowDragging.over(drag, item, e) && (dropId = item.id)}
              ondragleave={() => dropId === item.id && (dropId = null)}
              ondrop={(e) => ((dropId = null), drag && RowDragging.drop(drag, item, e))}>
              {#if selected && onselect && item.kind === 'file'}
                <input type="checkbox" class="select" checked={selected(item)} onchange={() => onselect(item)} aria-label="{item.name} auswählen" />
              {/if}
              <button class="tile" onclick={() => onopen(item)} aria-label={item.kind === 'folder' ? `Ordner ${item.name} öffnen` : `${item.name} öffnen`}
                {@attach tooltip(item.name)} {@attach menu ? contextMenu(() => menu(item)) : undefined}>
                <span class="preview">
                  {#if item.kind === 'file'}
                    <Thumbnail file={item.file} />
                  {:else}
                    {#snippet folderIcon()}
                      <span class="folder" style:--hue={item.kind === 'folder' && colorHue(item.folder.color) ? `var(--color-tag-${colorHue(item.folder.color)}-text)` : null}>
                        <Icon name="files" />
                      </span>
                    {/snippet}
                    {#if item.folder.coverFileId}
                      <CoverImage fileId={item.folder.coverFileId} alt="Titelbild {item.name}" fallback={folderIcon} />
                    {:else}
                      {@render folderIcon()}
                    {/if}
                  {/if}
                </span>
                <span class="name">
                  {#if item.kind === 'folder' && colorHue(item.folder.color)}<span class="dot" style:background="var(--color-tag-{colorHue(item.folder.color)}-text)"></span>{/if}
                  {item.name}
                </span>
              </button>
            </li>
          {/each}
        </ul>
      {:else}
        <Empty text={model.total ? 'Keine Einträge passen zu Suche und Filtern.' : emptyText}
          action={model.total ? (model.activeFilters ? { label: 'Filter zurücksetzen', run: () => model.reset() } : null) : emptyAction} />
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
  .cell {
    position: relative;
  }
  .select {
    position: absolute;
    top: var(--space-sm);
    left: var(--space-sm);
    z-index: 1;
    opacity: 0;
    transition: opacity var(--motion-fast);
  }
  .cell:hover .select,
  .cell.chosen .select,
  .select:focus-visible {
    opacity: 1;
  }
  .chosen .tile {
    box-shadow: 0 0 0 2px var(--color-accent);
  }
  .drop-target .tile {
    box-shadow: 0 0 0 2px var(--color-accent);
    transform: scale(1.02);
  }
  .cell.movable .tile {
    cursor: grab;
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
    color: var(--hue, var(--color-text-faint));
    background: color-mix(in srgb, var(--hue, var(--color-text-faint)) 10%, transparent);
  }
  .folder :global(.icon) {
    width: 32px;
    height: 32px;
  }
  .dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    margin-right: 6px;
    border-radius: 50%;
    vertical-align: 1px;
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
