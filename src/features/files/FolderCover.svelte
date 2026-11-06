<script lang="ts">
  import Icon from '../../ui/Icon.svelte';
  import CoverImage from './CoverImage.svelte';
  import { colorHue, type Folder } from './model';

  /** The picture of a folder tile: its cover photo, or the folder icon in the folder's colour. */
  let { folder }: { folder: Pick<Folder, 'name' | 'color' | 'coverFileId'> } = $props();
  const hue = $derived(colorHue(folder.color));
</script>

{#snippet icon()}
  <span class="folder" style:--hue={hue ? `var(--color-tag-${hue}-text)` : null}><Icon name="files" /></span>
{/snippet}
{#if folder.coverFileId}
  <CoverImage fileId={folder.coverFileId} alt="Titelbild {folder.name}" fallback={icon} />
{:else}
  {@render icon()}
{/if}

<style>
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
</style>
