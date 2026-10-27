<script lang="ts">
  import { settings } from '../../settings';
  import { session } from '../../lib/container';
  import { LineDiff } from '../../lib/diff/LineDiff';
  import { usePane } from '../../lib/split/usePane';
  import { Resource } from '../../lib/state/Resource.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';
  import Page from '../../ui/Page.svelte';
  import Select from '../../ui/Select.svelte';
  import type { PageProps } from '../Feature';
  import DocumentPreview from './DocumentPreview.svelte';
  import type { FileVersion, StoredFile } from './model';
  import { filePreviews, filesApi } from './services';

  /**
   * Two versions of a document side by side (opened in the split view from the version list). "Änderungen"
   * shows the text that was added or removed, for Word, Excel, PowerPoint and text files.
   */
  let { params }: PageProps = $props();
  const pane = usePane();

  type Mode = 'preview' | 'changes';
  let mode = $state<Mode>('preview');

  // svelte-ignore state_referenced_locally
  const fileId = params.id;
  const data = new Resource<{ file: StoredFile; versions: FileVersion[] }>(async () => {
    const folderId = pane.query.get('folder') ?? '';
    const [files, versions] = await Promise.all([filesApi.files(folderId), filesApi.versions(fileId)]);
    const file = files.find((f) => f.id === fileId);
    if (!file) throw new Error('Datei nicht gefunden.');
    return { file, versions };
  });
  void data.load();

  const a = $derived(pane.query.get('a') ?? '');
  const b = $derived(pane.query.get('b') ?? '');
  const pick = (key: 'a' | 'b', id: string) => pane.updateQuery({ [key]: id }, true);

  const label = (versions: readonly FileVersion[], id: string) => versions.find((v) => v.id === id)?.label ?? '?';
  const options = (versions: readonly FileVersion[]) =>
    versions.map((v) => ({ value: v.id, label: `${v.label} · ${session.format.date(v.date)}${v.current ? ' (aktuell)' : ''}` }));

  /** Changes between the two versions, loaded when that tab is shown. */
  const changes = new Resource(async () => {
    const file = data.value!.file;
    const [before, after] = await Promise.all(
      [a, b].map(async (id) =>
        (await filePreviews.lines(await filePreviews.versionContent(file.id, id, file.contentType), file.contentType)).slice(
          0,
          settings.files.compareMaxLines,
        ),
      ),
    );
    return LineDiff.fold(LineDiff.lines(before, after), settings.files.compareContextLines);
  });
  $effect(() => {
    if (mode === 'changes' && data.value && a && b) void changes.load();
  });
</script>

<AsyncView resource={data}>
  {#snippet children({ file, versions })}
    {@const comparable = filePreviews.comparable(file.contentType)}
    <Page title="Vergleich: {file.name}">
      {#snippet context()}
        <div class="pickers">
          <Select bind:value={() => a, (id) => pick('a', id)} options={options(versions)} aria-label="Ältere Version" />
          <span class="muted" aria-hidden="true">→</span>
          <Select bind:value={() => b, (id) => pick('b', id)} options={options(versions)} aria-label="Neuere Version" />
        </div>
      {/snippet}
      {#snippet contextEnd()}
        <ChoiceGroup
          name="compare-mode-{file.id}"
          label="Ansicht"
          size="sm"
          disabled={!comparable}
          options={[
            { value: 'preview', label: 'Vorschau' },
            { value: 'changes', label: 'Änderungen' },
          ]}
          bind:value={mode}
        />
      {/snippet}

      {#if mode === 'preview' || !comparable}
        {#if !comparable}<p class="muted note">
            Änderungen lassen sich nur bei Word, Excel, PowerPoint und Text anzeigen. Hier die beiden Versionen nebeneinander.
          </p>{/if}
        <div class="sides">
          {#each [a, b] as id, side (side)}
            <section>
              <h2>Version {label(versions, id)}</h2>
              {#key id}<DocumentPreview {file} load={() => filePreviews.versionContent(file.id, id, file.contentType)} />{/key}
            </section>
          {/each}
        </div>
      {:else}
        <p class="legend muted">
          <span class="swatch removed"></span> nur in {label(versions, a)}
          <span class="swatch added"></span> neu in {label(versions, b)}
        </p>
        <AsyncView resource={changes}>
          {#snippet children(blocks)}
            {#if blocks.every((block) => block.kind === 'same' || block.kind === 'folded')}
              <p class="muted">Der Text ist in beiden Versionen gleich.</p>
            {:else}
              <ol class="diff">
                {#each blocks as block, i (i)}
                  {#if block.kind === 'folded'}
                    <li class="folded muted">… {block.count} {block.count === 1 ? 'gleiche Zeile' : 'gleiche Zeilen'}</li>
                  {:else}
                    <li class={block.kind}>
                      <span class="sign" aria-hidden="true">{block.kind === 'added' ? '+' : block.kind === 'removed' ? '−' : ''}</span>
                      <span class="visually-hidden">{block.kind === 'added' ? 'Neu:' : block.kind === 'removed' ? 'Entfernt:' : ''}</span>
                      <span class="text">{block.text}</span>
                    </li>
                  {/if}
                {/each}
              </ol>
            {/if}
          {/snippet}
        </AsyncView>
      {/if}
    </Page>
  {/snippet}
</AsyncView>

<style>
  .pickers {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }
  .sides {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
    gap: var(--space-lg);
  }
  .sides h2 {
    margin-top: 0;
  }
  .note {
    margin-top: 0;
  }
  .legend {
    display: flex;
    align-items: center;
    gap: var(--space-xs) var(--space-sm);
    margin-top: 0;
    font-size: var(--font-size-small);
  }
  .swatch {
    width: 0.8rem;
    height: 0.8rem;
    border-radius: var(--radius-sm);
  }
  .swatch.added,
  .diff .added {
    background: color-mix(in srgb, var(--color-success) 14%, transparent);
  }
  .swatch.removed,
  .diff .removed {
    background: color-mix(in srgb, var(--color-danger) 14%, transparent);
  }
  .diff {
    margin: 0;
    padding: 0;
    overflow: hidden;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    list-style: none;
  }
  .diff li {
    display: grid;
    grid-template-columns: 1.5rem minmax(0, 1fr);
    padding: var(--space-xs) var(--space-sm);
    border-bottom: 1px solid var(--color-border);
  }
  .diff li:last-child {
    border-bottom: 0;
  }
  .diff .removed .text {
    text-decoration: line-through;
    text-decoration-color: color-mix(in srgb, var(--color-danger) 50%, transparent);
  }
  .sign {
    color: var(--color-text-muted);
    font-family: var(--font-mono);
  }
  .diff .folded {
    display: block;
    padding-left: calc(1.5rem + var(--space-sm));
    font-size: var(--font-size-small);
  }
  .text {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
