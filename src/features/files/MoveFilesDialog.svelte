<script lang="ts">
  import Button from '../../ui/Button.svelte';
  import Dialog from '../../ui/Dialog.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import type { FolderTree } from './FolderTree.svelte';
  import type { Folder, StoredFile } from './model';
  import { fileMover } from './services';

  /** Moves the selected files into another folder the member manages (files take its visibility). */
  let {
    files,
    folder,
    tree,
    onmoved,
    onclose,
  }: { files: readonly StoredFile[]; folder: Folder; tree: FolderTree; onmoved: () => void; onclose: () => void } = $props();

  const targets = $derived(
    (tree.folders.value ?? [])
      .filter((f) => fileMover.canMove(files, folder, f))
      .map((f) => ({
        value: f.id,
        label: tree
          .path(f.id)
          .map((p) => p.name)
          .join(' / '),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'de')),
  );
  let targetId = $state('');
  let busy = $state(false);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const target = tree.get(targetId);
    if (!target) return;
    busy = true;
    await fileMover.move(files, target);
    busy = false;
    onmoved();
  }
</script>

<Dialog open title={files.length === 1 ? 'Datei verschieben' : `${files.length} Dateien verschieben`} {onclose}>
  <form class="stack" onsubmit={submit}>
    {#if targets.length}
      <Field label="Nach" hint="Dateien sind für alle sichtbar, die ihren Ordner sehen.">
        <Select bind:value={targetId} options={targets} placeholder="Ordner wählen" />
      </Field>
    {:else}
      <p class="muted">Es gibt keinen Ordner, den du verwaltest und in den diese Dateien passen.</p>
    {/if}
    <div class="row end">
      <Button variant="ghost" onclick={onclose}>Abbrechen</Button>
      <Button type="submit" variant="primary" {busy} disabled={!targetId}>Verschieben</Button>
    </div>
  </form>
</Dialog>

<style>
  .end {
    justify-content: flex-end;
  }
</style>
