<script lang="ts">
  import type { Folder } from './model';
  import { RowDragging, type RowDrag } from '../../ui/rowDrag';

  /** "Dateien / Ordner / Unterordner"; the last entry is the current folder. Parent folders take dropped files. */
  let { path, drag }: { path: readonly Folder[]; drag?: RowDrag<Folder> } = $props();

  let dropId = $state<string | null>(null);
</script>

<nav aria-label="Ordnerpfad">
  <ol>
    <li>
      {#if path.length}<a href="#/files">Dateien</a>{:else}<span aria-current="page">Dateien</span>{/if}
    </li>
    {#each path as folder, index (folder.id)}
      <li>
        {#if index === path.length - 1}
          <span aria-current="page">{folder.name}</span>
        {:else}
          <a
            href="#/files/{folder.id}"
            class:drop-target={dropId === folder.id}
            ondragover={(e) => drag && RowDragging.over(drag, folder, e) && (dropId = folder.id)}
            ondragleave={() => dropId === folder.id && (dropId = null)}
            ondrop={(e) => ((dropId = null), drag && RowDragging.drop(drag, folder, e))}>{folder.name}</a
          >
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
    padding: 1px 4px;
    border-radius: var(--radius-sm);
    text-decoration: none;
    transition: background var(--motion-fast);
  }
  a:hover {
    text-decoration: underline;
  }
  a.drop-target {
    background: var(--color-accent-soft);
    color: var(--color-accent);
  }
</style>
