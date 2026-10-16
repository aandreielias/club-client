<script lang="ts">
  import ActivitySection from '../../ui/ActivitySection.svelte';
  import MemberName from '../../ui/MemberName.svelte';
  import { settings } from '../../settings';
  import { bus, directory, pendingDeletes, session } from '../../lib/container';
  import { APP_ERROR, TOAST } from '../../channels';
  import { Resource } from '../../lib/state/Resource.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import Detail from '../../ui/Detail.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { FolderContents } from './FolderContents.svelte';
  import { FolderTree } from './FolderTree.svelte';
  import type { Folder, StoredFile } from './model';
  import { fileDownloads, fileLinks, filePolicy, filePreviews, filesApi, fileTypes } from './services';
  import DocumentPreview from './DocumentPreview.svelte';
  import TagEditor from './TagEditor.svelte';
  import EditFileDialog from './EditFileDialog.svelte';
  import Thumbnail from './Thumbnail.svelte';

  /** One file in the window, photos with preview and tags; `id` is `<folderId>:<fileId>` (the server has no single-file endpoint). */
  let { id, handle }: { id: string; handle?: WindowHandle } = $props();

  // svelte-ignore state_referenced_locally
  const [folderId, fileId] = id.split(':');
  const contents = new FolderContents(filesApi, fileLinks, folderId);
  const tree = new FolderTree(filesApi, settings.files.maxFolderDepth);
  let tagging = $state(false);
  let editing = $state(false);

  const data = new Resource<{ folder: Folder; file: StoredFile }>(async () => {
    await Promise.all([tree.load(), contents.load()]);
    const folder = tree.get(folderId);
    const file = contents.files.value?.find((f) => f.id === fileId);
    if (!folder || !file) throw new Error('Datei nicht gefunden.');
    return { folder, file };
  });
  void data.load();

  // Tag changes update the folder contents; show the fresh copy.
  const file = $derived(contents.files.value?.find((f) => f.id === fileId) ?? data.value?.file);

  $effect(() => {
    if (file) handle?.setTitle(file.name);
  });

  const image = $derived(!!file && fileTypes.isImage(file.contentType));

  function remove(target: StoredFile) {
    pendingDeletes.schedule({ ids: [target.id], text: `„${target.name}“ gelöscht.`, commit: () => filesApi.deleteFile(target.id) });
    handle?.close();
  }

  async function download(target: StoredFile) {
    try {
      await fileDownloads.download(target);
    } catch (error) {
      bus.publish(APP_ERROR, error);
    }
  }
</script>

<AsyncView resource={data}>
  {#snippet children({ folder })}
    {#if file}
      <Detail title={file.name}>
        {#snippet actions()}
          <Button icon="download" onclick={() => download(file)}>Herunterladen</Button>
          {#if filePolicy.canModify(file, folder)}<Button icon="edit" onclick={() => (editing = true)} tooltip="Umbenennen oder verschieben">Bearbeiten</Button>{/if}
          {#if image && filePolicy.canTag(file, folder) && !tagging}<Button onclick={() => (tagging = true)}>Personen markieren</Button>{/if}
          {#if filePolicy.canModify(file, folder)}
            <Button variant="danger" busy={contents.deleteAction.busy} onclick={() => remove(file)} tooltip="{image ? 'Foto' : 'Datei'} endgültig löschen">Löschen</Button>
          {/if}
        {/snippet}

        {#if image}<div class="image"><Thumbnail {file} full /></div>{/if}
        {#if !image && filePreviews.kind(file.contentType)}<DocumentPreview {file} />{/if}

        <dl class="props">
          <dt>Ordner</dt>
          <dd>{folder.name}</dd>
          <dt>Typ</dt>
          <dd>{fileTypes.label(file.contentType)}</dd>
          <dt>Hochgeladen</dt>
          <dd>{session.format.dateTime(file.createdAt)},&nbsp;<MemberName memberId={file.uploadedBy} /></dd>
          <dt>Größe</dt>
          <dd>{session.format.bytes(file.sizeBytes)}{file.width && file.height ? `, ${file.width} × ${file.height}` : ''}</dd>
          {#if image}
            <dt>Markiert</dt>
            <dd>
              {#each file.taggedMemberIds as member (member)}<MemberName memberId={member} tag />{:else}<span class="muted">Niemand</span>{/each}
            </dd>
          {/if}
        </dl>

        {#if tagging}
          <h2>Personen markieren</h2>
          <TagEditor {file} {folder} {contents} ondone={() => (tagging = false)} />
        {/if}
        <ActivitySection kind="FILE" id={file.id} describe={(e) => (e.action === 'UPDATED' && e.detail ? `umbenannt oder verschoben: ${e.detail}` : null)} />
      </Detail>
    {/if}
  {/snippet}
</AsyncView>

{#if editing && file && data.value}
  <EditFileDialog {file} folder={data.value.folder} {tree} onclose={() => (editing = false)}
    onsaved={(saved) => {
      editing = false;
      bus.publish(TOAST, { text: 'Datei gespeichert.' });
      // A moved file lives under a new window id.
      if (saved.folderId !== folderId) handle?.replace('file', `${saved.folderId}:${saved.id}`);
      else void contents.load();
    }} />
{/if}

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
