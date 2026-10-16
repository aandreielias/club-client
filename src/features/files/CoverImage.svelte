<script lang="ts">
  import { fileLinks } from './services';

  /** A folder's cover photo, by file id (its thumbnail). Falls back to `fallback` when it cannot load. */
  let { fileId, alt, fallback }: { fileId: string; alt: string; fallback: import('svelte').Snippet } = $props();

  let src = $state<string | null>(null);
  let failed = $state(false);

  $effect(() => {
    let cancelled = false;
    failed = false;
    fileLinks
      .url(fileId, true)
      .then((url) => !cancelled && (src = url))
      .catch(() => !cancelled && (failed = true));
    return () => (cancelled = true);
  });
</script>

{#if src && !failed}
  <img {src} {alt} loading="lazy" onerror={() => (failed = true)} />
{:else}
  {@render fallback()}
{/if}

<style>
  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>
