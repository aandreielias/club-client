<script lang="ts">
  import { settings } from '../../settings';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Icon from '../../ui/Icon.svelte';
  import SectionHeading from '../../ui/SectionHeading.svelte';
  import { tooltip } from '../../ui/tooltip';
  import CoverImage from './CoverImage.svelte';
  import { FolderTree } from './FolderTree.svelte';
  import { colorHue } from './model';
  import { filesApi } from './services';

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
          {@const hue = colorHue(folder.color)}
          <li>
            <a class="tile" href="#/files/{folder.id}" {@attach tooltip(`${folder.name} öffnen`)}>
              <span class="preview" style:--hue={hue ? `var(--color-tag-${hue}-text)` : null}>
                {#snippet icon()}<Icon name="files" />{/snippet}
                {#if folder.coverFileId}<CoverImage
                    fileId={folder.coverFileId}
                    alt="Titelbild {folder.name}"
                    fallback={icon}
                  />{:else}{@render icon()}{/if}
              </span>
              <span class="name">{folder.name}</span>
            </a>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="muted">Noch keine Ordner.</p>
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
    border-radius: var(--radius-lg);
    background: var(--color-elevated);
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
    display: grid;
    place-items: center;
    overflow: hidden;
    aspect-ratio: 16 / 9;
    color: var(--hue, var(--color-text-faint));
    background: color-mix(in srgb, var(--hue, var(--color-text-faint)) 10%, transparent);
  }
  /* The cover fills the tile without stretching it. */
  .preview :global(img) {
    position: absolute;
    inset: 0;
  }
  .preview :global(.icon) {
    width: 24px;
    height: 24px;
  }
  .name {
    padding: var(--space-xs) var(--space-sm);
    overflow: hidden;
    font-size: var(--font-size-small);
    font-weight: var(--font-weight-medium);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
