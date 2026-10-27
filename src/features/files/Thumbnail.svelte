<script lang="ts">
  import type { StoredFile } from './model';
  import { fileLinks, fileTypes } from './services';

  /** Loads the file's thumbnail link lazily; shows the type name when there is no preview. */
  let { file, full = false }: { file: StoredFile; full?: boolean } = $props();

  let src = $state<string | null>(null);
  let failed = $state(false);

  $effect(() => {
    const wanted = full || file.hasThumbnail;
    if (!wanted) return;
    let cancelled = false;
    fileLinks
      .url(file.id, !full)
      .then((url) => !cancelled && (src = url))
      .catch(() => !cancelled && (failed = true));
    return () => (cancelled = true);
  });
</script>

{#if src && !failed}
  <img
    {src}
    alt={file.name}
    loading="lazy"
    width={full ? file.width : undefined}
    height={full ? file.height : undefined}
    onerror={() => (failed = true)}
  />
{:else}
  <span class="placeholder muted">{failed || !(full || file.hasThumbnail) ? fileTypes.label(file.contentType) : 'Laden …'}</span>
{/if}

<style>
  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .placeholder {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    font-size: var(--font-size-small);
    background: var(--color-surface);
  }
</style>
