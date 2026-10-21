<script lang="ts">
  import { Action } from '../../lib/state/Action.svelte';
  import Button from '../../ui/Button.svelte';
  import Dialog from '../../ui/Dialog.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import { FileEditForm } from './FolderEditForm.svelte';
  import type { FolderTree } from './FolderTree.svelte';
  import type { Folder, StoredFile } from './model';
  import { filesApi, fileTypes } from './services';

  /**
   * Rename a file; managers also move it to another folder they manage (that changes who sees it,
   * since files take the visibility of their folder).
   */
  let {
    file,
    folder,
    tree,
    onsaved,
    onclose,
  }: { file: StoredFile; folder: Folder; tree: FolderTree; onsaved: (file: StoredFile) => void; onclose: () => void } = $props();

  // svelte-ignore state_referenced_locally
  const form = new FileEditForm(file);
  const action = new Action();
  // svelte-ignore state_referenced_locally
  const image = fileTypes.isImage(file.contentType);
  const targets = $derived(
    (tree.folders.value ?? [])
      .filter((f) => f.id === folder.id || (f.canManage && (image || f.kind === 'DOCUMENTS')))
      .map((f) => ({ value: f.id, label: tree.path(f.id).map((p) => p.name).join(' / ') }))
      .sort((a, b) => a.label.localeCompare(b.label, 'de')),
  );

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    form.submitted = true;
    if (!form.valid) return;
    const patch = form.toPatch();
    if (!Object.keys(patch).length) return onclose();
    const saved = await action.attempt(() => filesApi.updateFile(file.id, patch));
    if (saved) onsaved(saved);
  }
</script>

<Dialog open title="Datei bearbeiten" {onclose}>
  <form class="stack" onsubmit={submit} novalidate>
    <Field label="Name" error={form.error}>
      <div class="name">
        <!-- svelte-ignore a11y_autofocus -->
        <input bind:value={form.base} maxlength={100 - form.extension.length} autofocus required />
        {#if form.extension}<span class="muted extension">{form.extension}</span>{/if}
      </div>
    </Field>
    {#if folder.canManage}
      <Field label="Ordner" hint="Dateien sind für alle sichtbar, die ihren Ordner sehen.">
        <Select bind:value={form.folderId} options={targets} />
      </Field>
    {/if}
    <ErrorNote error={action.error} />
    <div class="row end">
      <Button variant="ghost" onclick={onclose}>Abbrechen</Button>
      <Button type="submit" variant="primary" busy={action.busy}>Speichern</Button>
    </div>
  </form>
</Dialog>

<style>
  .name {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
  }
  .extension {
    flex-shrink: 0;
  }
  .end {
    justify-content: flex-end;
  }
</style>
