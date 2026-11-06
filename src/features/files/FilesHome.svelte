<script lang="ts">
  import { settings } from '../../settings';
  import AsyncView from '../../ui/AsyncView.svelte';
  import SectionHeading from '../../ui/SectionHeading.svelte';
  import { tooltip } from '../../ui/tooltip';
  import FolderCover from './FolderCover.svelte';
  import { FolderTree } from './FolderTree.svelte';
  import { filePolicy, filesApi } from './services';

  /** Start page section: the top-level folders as small tiles (cover photo or coloured folder). */
  const tree = new FolderTree(filesApi, settings.files.maxFolderDepth);
  void tree.load();
</script>

<SectionHeading title="Ordner" href="#/files" />
<AsyncView resource={tree.folders}>
  {#snippet children()}
    {@const roots = tree.children(null)}
    {#if roots.length}
      <ul class="tiles">
        {#each roots as folder (folder.id)}
          <li>
            <a class="tile" href="#/files/{folder.id}" {@attach tooltip(`${folder.name} öffnen`)}>
              <span class="preview"><FolderCover {folder} /></span>
              <span class="name">{folder.name}</span>
            </a>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="empty">
        Noch keine Ordner.{#if filePolicy.canCreateRoot()}
          <a href="#/files">Neuer Ordner</a>{/if}
      </p>
    {/if}
  {/snippet}
</AsyncView>

<style>
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
    gap: var(--space-sm);
  }
  .tile {
    display: grid;
    overflow: hidden;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-background);
    color: inherit;
    text-decoration: none;
    transition:
      box-shadow var(--motion-fast),
      transform var(--motion-base) var(--motion-easing);
  }
  .tile:hover {
    box-shadow: var(--color-shadow-popover);
    transform: translateY(-1px);
  }
  .preview {
    position: relative;
    display: block;
    overflow: hidden;
    aspect-ratio: 16 / 9;
    background: var(--color-surface);
  }
  /* The cover fills the tile without stretching it. */
  .preview :global(img) {
    position: absolute;
    inset: 0;
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
