<script lang="ts">
  import { Resource } from '../../lib/state/Resource.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import type { StoredFile } from './model';
  import { filePreviews } from './services';
  import type { Sheet, Slide } from './OfficeReader';
  import SheetPreview from './SheetPreview.svelte';
  import SlidesPreview from './SlidesPreview.svelte';

  /** Preview of a PDF or Word document inside the file window; `load` shows another version's content. */
  let { file, load }: { file: StoredFile; load?: () => Promise<Blob> } = $props();

  // svelte-ignore state_referenced_locally
  const kind = filePreviews.kind(file.contentType);
  // svelte-ignore state_referenced_locally
  const content = new Resource(() => (load ? load() : filePreviews.content(file.id, file.contentType)));
  const loaded = content.load();

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
    await loaded; // the same download, not a second one
    if (!content.value) throw content.error ?? new Error('Vorschau nicht verfügbar.');
    return kind === 'xlsx' ? filePreviews.office.sheets(content.value) : filePreviews.office.slides(content.value);
  });
  if (kind === 'xlsx' || kind === 'pptx') void office.load();

  let docxError = $state<unknown>(null);
  let docxHtml = $state<string | null>(null);
  $effect(() => {
    const blob = content.value;
    if (!blob || kind !== 'docx') return;
    const background = getComputedStyle(document.documentElement).getPropertyValue('--color-surface');
    filePreviews.renderDocx(blob, background).then((html) => (docxHtml = html), (error) => (docxError = error));
  });
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
          <!-- No allow-scripts and no allow-same-origin: the document cannot reach the app. -->
          {#if docxHtml}<iframe sandbox="allow-popups allow-popups-to-escape-sandbox" srcdoc={docxHtml} title="Vorschau {file.name}"></iframe>{/if}
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
    /* Word pages keep their A4 width; narrow places (version comparison) scroll instead of cutting them off. */
    overflow: auto;
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
  .note {
    margin: 0;
    padding: var(--space-lg);
  }
</style>
