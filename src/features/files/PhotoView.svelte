<script lang="ts">
  import { settings } from '../../settings';
  import { confirmation, directory, errors, session, toasts } from '../../lib/container';
  import { Resource } from '../../lib/state/Resource.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import Detail from '../../ui/Detail.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { FolderContents } from './FolderContents.svelte';
  import { FolderTree } from './FolderTree.svelte';
  import type { Folder, StoredFile } from './model';
  import { fileDownloads, fileLinks, filePolicy, filesApi } from './services';
  import TagEditor from './TagEditor.svelte';
  import Thumbnail from './Thumbnail.svelte';

  /** One photo in the window; `id` is `<folderId>:<fileId>` (the server has no single-file endpoint). */
  let { id, handle }: { id: string; handle?: WindowHandle } = $props();

  // svelte-ignore state_referenced_locally
  const [folderId, fileId] = id.split(':');
  const contents = new FolderContents(filesApi, fileLinks, folderId);
  const tree = new FolderTree(filesApi, settings.files.maxFolderDepth);
  let tagging = $state(false);

  const data = new Resource<{ folder: Folder; file: StoredFile }>(async () => {
    await Promise.all([tree.load(), contents.load()]);
    const folder = tree.get(folderId);
    const file = contents.files.value?.find((f) => f.id === fileId);
    if (!folder || !file) throw new Error('Foto nicht gefunden.');
    return { folder, file };
  });
  void data.load();

  // Tag changes update the folder contents; show the fresh copy.
  const file = $derived(contents.files.value?.find((f) => f.id === fileId) ?? data.value?.file);

  $effect(() => {
    if (file) handle?.setTitle(file.name);
  });

  async function remove(target: StoredFile) {
    const ok = await confirmation.ask({ title: 'Foto löschen', message: `„${target.name}“ wird endgültig gelöscht.`, confirmLabel: 'Löschen', danger: true });
    if (!ok) return;
    if (await contents.delete(target)) {
      toasts.show('Foto gelöscht.');
      handle?.close();
    } else {
      toasts.error(errors.text(contents.deleteAction.error));
    }
  }

  async function download(target: StoredFile) {
    try {
      await fileDownloads.download(target);
    } catch (error) {
      toasts.error(errors.text(error));
    }
  }
</script>

<AsyncView resource={data}>
  {#snippet children({ folder })}
    {#if file}
      <Detail title={file.name}>
        {#snippet actions()}
          <Button onclick={() => download(file)}>Herunterladen</Button>
          {#if filePolicy.canTag(file, folder) && !tagging}<Button onclick={() => (tagging = true)}>Personen markieren</Button>{/if}
          {#if filePolicy.canModify(file, folder)}
            <Button variant="danger" busy={contents.deleteAction.busy} onclick={() => remove(file)}>Löschen</Button>
          {/if}
        {/snippet}

        <div class="image"><Thumbnail {file} full /></div>

        <dl class="props">
          <dt>Ordner</dt>
          <dd>{folder.name}</dd>
          <dt>Hochgeladen</dt>
          <dd>{session.format.dateTime(file.createdAt)}, {directory.nameOf(file.uploadedBy)}</dd>
          <dt>Größe</dt>
          <dd>{session.format.bytes(file.sizeBytes)}{file.width && file.height ? `, ${file.width} × ${file.height}` : ''}</dd>
          <dt>Markiert</dt>
          <dd>
            {#each file.taggedMemberIds as member (member)}<Tag tone="gray">{directory.nameOf(member)}</Tag>{:else}<span class="muted">Niemand</span>{/each}
          </dd>
        </dl>

        {#if tagging}
          <h2>Personen markieren</h2>
          <TagEditor {file} {folder} {contents} ondone={() => (tagging = false)} />
        {/if}
      </Detail>
    {/if}
  {/snippet}
</AsyncView>

<style>
  .image {
    display: grid;
    place-items: center;
    max-height: 70vh;
    overflow: hidden;
    border-radius: var(--radius-md);
    background: var(--color-surface);
  }
  .image :global(img) {
    width: 100%;
    max-height: 70vh;
    object-fit: contain;
  }
</style>
