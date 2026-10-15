<script lang="ts">
  import type { Folder } from './model';

  /** "Dateien / Ordner / Unterordner"; the last entry is the current folder. */
  let { path }: { path: readonly Folder[] } = $props();
</script>

<nav aria-label="Ordnerpfad">
  <ol>
    <li>{#if path.length}<a href="#/files">Dateien</a>{:else}<span aria-current="page">Dateien</span>{/if}</li>
    {#each path as folder, index (folder.id)}
      <li>
        {#if index === path.length - 1}
          <span aria-current="page">{folder.name}</span>
        {:else}
          <a href="#/files/{folder.id}">{folder.name}</a>
        {/if}
      </li>
    {/each}
  </ol>
</nav>

<style>
  ol {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: var(--font-size-small);
    color: var(--color-text-muted);
  }
  li + li::before {
    content: '/';
    margin-right: var(--space-xs);
  }
  a {
    text-decoration: none;
  }
  a:hover {
    text-decoration: underline;
  }
</style>
