<script lang="ts">
  import { settings } from '../../settings';
  import { errors } from '../../lib/container';
  import Button from '../../ui/Button.svelte';
  import type { Folder, StoredFile } from './model';
  import { filesApi, fileTypes } from './services';
  import { UploadQueue } from './UploadQueue.svelte';

  /** Drop zone + file picker + per-file progress for one folder. */
  let { folder, onuploaded }: { folder: Folder; onuploaded: (file: StoredFile) => void } = $props();

  // svelte-ignore state_referenced_locally
  const queue = new UploadQueue(filesApi, fileTypes, errors, settings.files.maxUploadBytes, () => folder, (f) => onuploaded(f));
  let input: HTMLInputElement;
  let dragging = $state(false);

  const STATE_LABELS = { waiting: 'Wartet', uploading: 'Lädt hoch', done: 'Fertig', failed: 'Fehler' } as const;

  function drop(event: DragEvent) {
    event.preventDefault();
    dragging = false;
    if (event.dataTransfer?.files.length) queue.add(event.dataTransfer.files);
  }

  function picked() {
    if (input.files?.length) queue.add(input.files);
    input.value = '';
  }
</script>

<section class="stack">
  <div
    class="zone"
    class:dragging
    role="region"
    aria-label="Dateien hochladen"
    ondragover={(e) => (e.preventDefault(), (dragging = true))}
    ondragleave={() => (dragging = false)}
    ondrop={drop}
  >
    <p class="muted">Dateien hierher ziehen oder</p>
    <Button onclick={() => input.click()}>Dateien auswählen</Button>
    <p class="muted hint">
      {fileTypes.describe(folder.kind)}, höchstens {Math.floor(settings.files.maxUploadBytes / 1024 / 1024)} MB pro Datei. Dateien werden auf Viren geprüft.
    </p>
    <input bind:this={input} type="file" multiple accept={fileTypes.accept(folder.kind)} onchange={picked} hidden />
  </div>

  {#if queue.items.length}
    <ul class="queue" aria-live="polite">
      {#each queue.items as item (item.key)}
        <li class:failed={item.state === 'failed'}>
          <span class="name">{item.file.name}</span>
          <progress max="1" value={item.progress} aria-label="Fortschritt {item.file.name}"></progress>
          <span class="state">{STATE_LABELS[item.state]}</span>
          {#if item.error}<span class="error">{item.error}</span>{/if}
        </li>
      {/each}
    </ul>
    {#if !queue.busy}<div><Button variant="ghost" onclick={() => queue.clearFinished()}>Liste leeren</Button></div>{/if}
  {/if}
</section>

<style>
  .zone {
    display: grid;
    justify-items: center;
    gap: var(--space-sm);
    padding: var(--space-xl) var(--space-lg);
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-lg);
    text-align: center;
  }
  .zone.dragging {
    border-color: var(--color-accent);
    background: var(--color-surface);
  }
  .zone p {
    margin: 0;
  }
  .hint {
    font-size: var(--font-size-small);
  }
  .queue {
    display: grid;
    gap: var(--space-xs);
  }
  .queue li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 8rem 6rem;
    gap: var(--space-xs) var(--space-md);
    align-items: center;
    font-size: var(--font-size-small);
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  progress {
    width: 100%;
  }
  .error {
    grid-column: 1 / -1;
    color: var(--color-danger);
  }
  .failed .state {
    color: var(--color-danger);
  }
</style>
