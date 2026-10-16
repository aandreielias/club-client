<script lang="ts">
  import { Resource } from '../../lib/state/Resource.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import type { StoredFile } from './model';
  import { filePreviews } from './services';

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
