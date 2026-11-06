<script lang="ts">
  import { Action } from '../../lib/state/Action.svelte';
  import Button from '../../ui/Button.svelte';
  import Dialog from '../../ui/Dialog.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import type { FolderTree } from './FolderTree.svelte';
  import type { Folder } from './model';
  import { filesApi } from './services';

  /**
   * Moves a folder with everything in it below another folder the member manages, or to the top level (server:
   * FolderHandlers.movableInto). Below another folder it takes that folder's visibility.
   */
  let { folder, tree, onmoved, onclose }: { folder: Folder; tree: FolderTree; onmoved: () => void; onclose: () => void } = $props();

  const TOP = 'top';
  const all = $derived(tree.folders.value ?? []);
  /** The folder and everything below it. */
  const moved = $derived.by(() => {
    const ids = new Set([folder.id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const f of all) {
        if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) {
          ids.add(f.id);
          grew = true;
        }
      }
    }
    return ids;
  });
  /** Levels the moved tree needs: the folder plus its deepest chain of subfolders. */
  const height = $derived(Math.max(...[...moved].map((id) => tree.depth(id))) - tree.depth(folder.id) + 1);
  const targets = $derived([
    ...(folder.parentId ? [{ value: TOP, label: 'Oberste Ebene' }] : []),
    ...all
      .filter((f) => f.canManage && !moved.has(f.id) && f.id !== folder.parentId && tree.depth(f.id) + height <= tree.maxDepth)
      .map((f) => ({
        value: f.id,
        label: tree
          .path(f.id)
          .map((p) => p.name)
          .join(' / '),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'de')),
  ]);
  let targetId = $state('');
  const action = new Action();

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const patch = targetId === TOP ? { moveToTop: true } : { parentId: targetId };
    if (await action.run(() => filesApi.updateFolder(folder.id, patch))) onmoved();
  }
</script>

<Dialog open title="Ordner verschieben" {onclose}>
  <form class="stack" onsubmit={submit}>
    {#if targets.length}
      <Field label="Nach" hint="Unter einem anderen Ordner gilt dessen Sichtbarkeit, auch für alles darin.">
        <Select bind:value={targetId} options={targets} placeholder="Ziel wählen" />
      </Field>
    {:else}
      <p class="muted">Es gibt keinen Ordner, den du verwaltest und unter den dieser Ordner passt.</p>
    {/if}
    <ErrorNote error={action.error} />
    <div class="row">
      <Button type="submit" variant="primary" busy={action.busy} disabled={!targetId}>Verschieben</Button>
      <Button variant="ghost" onclick={onclose}>Abbrechen</Button>
    </div>
  </form>
</Dialog>
