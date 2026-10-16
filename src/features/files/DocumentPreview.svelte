<script lang="ts">
  import { Resource } from '../../lib/state/Resource.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import type { StoredFile } from './model';
  import { filePreviews } from './services';
  import type { Sheet, Slide } from './OfficeReader';
  import SheetPreview from './SheetPreview.svelte';
  import SlidesPreview from './SlidesPreview.svelte';

  /** Preview of a PDF or Word document inside the file window. */
  let { file }: { file: StoredFile } = $props();

  // svelte-ignore state_referenced_locally
  const kind = filePreviews.kind(file.contentType);
  // svelte-ignore state_referenced_locally
  const content = new Resource(() => filePreviews.content(file.id, file.contentType));
  void content.load();

  let pdfUrl = $state<string | null>(null);
  $effect(() => {
    const blob = content.value;
    if (!blob || kind !== 'pdf') return;
    const url = URL.createObjectURL(blob);
    pdfUrl = url;
    return () => URL.revokeObjectURL(url);
  });

  // Excel and PowerPoint: their text, read once the content is there.
  // svelte-ignore state_referenced_locally
  const office = new Resource<Sheet[] | Slide[]>(async () => {
    await content.load();
    if (!content.value) throw content.error ?? new Error('Vorschau nicht verfügbar.');
    return kind === 'xlsx' ? filePreviews.office.sheets(content.value) : filePreviews.office.slides(content.value);
  });
  if (kind === 'xlsx' || kind === 'pptx') void office.load();

  let docxError = $state<unknown>(null);
  function renderDocx(target: HTMLElement) {
    const blob = content.value;
    if (blob) filePreviews.renderDocx(blob, target).catch((error) => (docxError = error));
  }
</script>

<div class="preview">
  <AsyncView resource={content}>
    {#snippet children()}
      {#if kind === 'pdf' && pdfUrl}
        <iframe src={pdfUrl} title="Vorschau {file.name}"></iframe>
      {:else if kind === 'docx'}
        {#if docxError}
          <p class="muted note">Für dieses Dokument gibt es keine Vorschau. Bitte herunterladen.</p>
        {:else}
          <div class="docx" {@attach renderDocx}></div>
        {/if}
      {:else if kind === 'xlsx' || kind === 'pptx'}
        {#if office.error}
          <p class="muted note">Für diese Datei gibt es keine Vorschau. Bitte herunterladen.</p>
        {:else}
          <AsyncView resource={office}>
            {#snippet children(parsed)}
              {#if kind === 'xlsx'}<SheetPreview sheets={parsed as Sheet[]} />{:else}<SlidesPreview slides={parsed as Slide[]} />{/if}
            {/snippet}
          </AsyncView>
        {/if}
      {/if}
    {/snippet}
  </AsyncView>
</div>

<style>
  .preview {
    overflow: hidden;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
  }
  iframe {
    display: block;
    width: 100%;
    height: min(75vh, 900px);
    border: 0;
  }
  .docx {
    max-height: min(75vh, 900px);
    overflow: auto;
  }
  /* docx-preview draws white pages on a grey desk; keep the desk in the house colours. */
  .docx :global(.docx-wrapper) {
    padding: var(--space-lg);
    background: var(--color-surface);
  }
  .note {
    margin: 0;
    padding: var(--space-lg);
  }
</style>
