<script lang="ts">
  import { openTab } from '../../lib/window/openTab';
  import { bus, session } from '../../lib/container';
  import { APP_ERROR } from '../../channels';
  import { Resource } from '../../lib/state/Resource.svelte';
  import { SPLIT_OPEN } from '../../lib/split/SplitView.svelte';
  import Button from '../../ui/Button.svelte';
  import MemberName from '../../ui/MemberName.svelte';
  import Tag from '../../ui/Tag.svelte';
  import type { StoredFile } from './model';
  import { fileLinks, filesApi } from './services';

  /** Version history of a document; two picked versions open side by side in the split view. */
  /** `onopencompare` closes the window and then opens the comparison (or opens it right away without a window). */
  let { file, onopencompare }: { file: StoredFile; onopencompare: (open: () => void) => void } = $props();

  // svelte-ignore state_referenced_locally
  const versions = new Resource(() => filesApi.versions(file.id));
  // Loads on mount and again when a new version arrives (the window shows the fresh file).
  $effect(() => {
    void file.version;
    void versions.load();
  });

  let picked = $state<string[]>([]);
  // The two newest versions are picked until the member chooses others.
  $effect(() => {
    const list = versions.value ?? [];
    if (!picked.length && list.length >= 2) picked = [list[1].id, list[0].id];
  });

  function toggle(id: string) {
    picked = picked.includes(id) ? picked.filter((p) => p !== id) : [...picked, id].slice(-2);
  }

  async function download(versionId: string) {
    try {
      await openTab(fileLinks.versionUrl(file.id, versionId));
    } catch (error) {
      bus.publish(APP_ERROR, error);
    }
  }

  function compare() {
    const list = versions.value ?? [];
    // Older version left, newer right.
    const [a, b] = [...picked].sort((x, y) => list.findIndex((v) => v.id === y) - list.findIndex((v) => v.id === x));
    onopencompare(() => bus.publish(SPLIT_OPEN, { path: `/files/${file.id}/compare?folder=${file.folderId}&a=${a}&b=${b}` }));
  }
</script>

{#if (versions.value?.length ?? 0) > 1}
  <h2 class="heading">
    Versionen
    <Button size="sm" variant="ghost" icon="split" disabled={picked.length !== 2} onclick={compare}>Vergleichen</Button>
  </h2>
  <ul class="versions">
    {#each versions.value ?? [] as version (version.id)}
      <li>
        <input type="checkbox" checked={picked.includes(version.id)} onchange={() => toggle(version.id)} aria-label="Version {version.label} zum Vergleichen wählen" />
        <span class="label">
          <Tag tone={version.current ? 'blue' : 'gray'}>{version.label}</Tag>
          {#if version.current}<span class="muted small">aktuell</span>{/if}
        </span>
        <span class="muted">Stand {session.format.date(version.date)}</span>
        <span class="muted who">{#if version.uploadedBy}<MemberName memberId={version.uploadedBy} />{/if}</span>
        <span class="muted size">{session.format.bytes(version.sizeBytes)}</span>
        <Button size="sm" variant="ghost" icon="download" tooltip="Version {version.label} herunterladen" onclick={() => download(version.id)} />
      </li>
    {/each}
  </ul>
{/if}

<style>
  .heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
  }
  .versions {
    display: grid;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .versions li {
    display: grid;
    grid-template-columns: auto 8rem minmax(0, 1fr) minmax(0, 1fr) 5rem auto;
    align-items: center;
    gap: var(--space-sm);
    min-height: var(--control-height);
    border-bottom: 1px solid var(--color-border);
  }
  .label {
    display: inline-flex;
    align-items: center;
    gap: var(--space-xs);
  }
  .small {
    font-size: var(--font-size-small);
  }
  .size {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .who {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  :global(:root[data-layout='compact']) .versions li {
    grid-template-columns: auto auto minmax(0, 1fr) auto;
  }
  :global(:root[data-layout='compact']) .who,
  :global(:root[data-layout='compact']) .size {
    display: none;
  }
</style>
