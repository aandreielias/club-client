<script lang="ts">
  import { settings } from '../../settings';
  import { bus, commands, directory, permissions, session, store } from '../../lib/container';
  import { APP_ERROR, CONFIRM, NAVIGATE, TOAST, WINDOW_OPEN } from '../../channels';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import Button from '../../ui/Button.svelte';
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';
  import type { MenuEntry } from '../../lib/overlay/ContextMenuService.svelte';
  import DataTable from '../../ui/DataTable.svelte';
  import Empty from '../../ui/Empty.svelte';
  import Page from '../../ui/Page.svelte';
  import Breadcrumb from './Breadcrumb.svelte';
  import CreateFolderDialog from './CreateFolderDialog.svelte';
  import { FILES_CHANGED, type FilesChanged } from './events';
  import { FolderContents } from './FolderContents.svelte';
  import FolderGallery from './FolderGallery.svelte';
  import { FolderItemListModel, type FolderItem } from './FolderItemListModel.svelte';
  import { FolderTree } from './FolderTree.svelte';
  import type { Folder } from './model';
  import { fileDownloads, fileLinks, filePolicy, filesApi, fileTypes } from './services';
  import UploadPanel from './UploadPanel.svelte';

  /** '/files' (root folders) or '/files/:id' (one folder). */
  let { params }: { params: Record<string, string> } = $props();

  type View = 'table' | 'gallery';
  const VIEWS: readonly { value: View; label: string }[] = [
    { value: 'table', label: 'Tabelle' },
    { value: 'gallery', label: 'Galerie' },
  ];

  // svelte-ignore state_referenced_locally
  const folderId = params.id ?? null;
  const tree = new FolderTree(filesApi, settings.files.maxFolderDepth);
  const contents = folderId ? new FolderContents(filesApi, fileLinks, folderId) : null;
  const list = new FolderItemListModel(tree, contents, folderId, fileTypes, () => session.format, directory, store);
  void list.load();
  directory.loadRosters();
  if (permissions.isManager) directory.loadTeams().catch(() => {});

  useBus(bus, FILES_CHANGED, ({ data }) => {
    if (data.folderId !== folderId) return;
    fileLinks.forget(data.fileId);
    void list.load();
  });

  const folder = $derived(folderId ? tree.get(folderId) : undefined);
  const canCreate = $derived(folderId ? !!folder && filePolicy.canCreateIn(folder, tree.depth(folder.id), tree.maxDepth) : filePolicy.canCreateRoot());
  let view = $state<View | null>(null);
  const shownView = $derived<View>(view ?? (folder?.kind === 'PHOTOS' ? 'gallery' : 'table'));
  let creating = $state(false);
  useCommands(commands, { 'page.new': { run: () => (creating = true), when: () => canCreate } });

  function open(item: FolderItem) {
    if (item.kind === 'folder') bus.publish(NAVIGATE, { path: `/files/${item.id}` });
    else bus.publish(WINDOW_OPEN, { kind: 'file', id: `${item.file.folderId}:${item.file.id}` });
  }

  async function download(item: FolderItem) {
    if (item.kind !== 'file') return;
    try {
      await fileDownloads.download(item.file);
    } catch (error) {
      bus.publish(APP_ERROR, error);
    }
  }

  async function removeFile(item: FolderItem) {
    if (item.kind !== 'file' || !contents) return;
    const ok = await bus.request(CONFIRM, { title: 'Datei löschen', message: `„${item.name}“ wird endgültig gelöscht.`, confirmLabel: 'Löschen', danger: true });
    if (!ok) return;
    if (await contents.delete(item.file)) {
      list.refresh();
      bus.publish(TOAST, { text: 'Datei gelöscht.' });
    } else {
      bus.publish(APP_ERROR, contents.deleteAction.error);
    }
  }

  /** Folder: open. File: open, download, delete (where allowed). */
  function itemMenu(item: FolderItem): MenuEntry[] {
    if (item.kind === 'folder') return [{ label: 'Öffnen', run: () => open(item) }];
    return [
      { label: 'Öffnen', run: () => open(item) },
      { label: 'Herunterladen', run: () => void download(item) },
      { separator: true },
      ...(folder && filePolicy.canModify(item.file, folder) ? [{ label: 'Löschen', danger: true, run: () => void removeFile(item) }] : []),
    ];
  }

  function created(newFolder: Folder) {
    creating = false;
    tree.add(newFolder);
    list.refresh();
    bus.publish(TOAST, { text: 'Ordner angelegt.' });
  }

  async function deleteFolder(target: Folder) {
    const ok = await bus.request(CONFIRM, {
      title: 'Ordner löschen',
      message: `„${target.name}“ wird gelöscht. Das geht nur, wenn er leer ist.`,
      confirmLabel: 'Löschen',
      danger: true,
    });
    if (!ok) return;
    try {
      await filesApi.deleteFolder(target.id);
      tree.remove(target.id);
      bus.publish(TOAST, { text: 'Ordner gelöscht.' });
      bus.publish(NAVIGATE, { path: target.parentId ? `/files/${target.parentId}` : '/files' });
    } catch (error) {
      bus.publish(APP_ERROR, error);
    }
  }
</script>

<Page title={folder?.name ?? 'Dateien'}>
  {#snippet actions()}
    <ChoiceGroup name="files-view" label="Ansicht" options={VIEWS} bind:value={() => shownView, (v) => (view = v)} />
    {#if folder?.canManage}<Button variant="danger" onclick={() => deleteFolder(folder)}>Ordner löschen</Button>{/if}
    {#if canCreate}<Button variant="primary" onclick={() => (creating = true)}>{folderId ? 'Neuer Unterordner' : 'Neuer Ordner'}</Button>{/if}
  {/snippet}
  {#snippet context()}
    <Breadcrumb path={folder ? tree.path(folder.id) : []} />
  {/snippet}

  {#if folderId && tree.folders.value && !folder}
    <Empty text="Ordner nicht gefunden." />
  {:else}
    {#if shownView === 'gallery'}
      <FolderGallery model={list} onopen={open} />
    {:else}
      <DataTable model={list} rowKey={(item) => item.id} onopen={open} menu={itemMenu} emptyText={folderId ? 'Noch nichts hochgeladen.' : 'Noch keine Ordner.'}>
        {#snippet cell(item, column)}
          {#if column.key === 'actions'}
            {#if item.kind === 'file' && folder && filePolicy.canModify(item.file, folder)}
              <Button size="sm" variant="ghost" onclick={(e) => (e.stopPropagation(), removeFile(item))}>Löschen</Button>
            {/if}
          {:else if column.key === 'name'}
            <span>{item.name}</span>
          {:else}
            {list.display(item, column)}
          {/if}
        {/snippet}
      </DataTable>
    {/if}

    {#if folder?.canUpload && contents}
      <div class="upload">
        <UploadPanel {folder} onuploaded={(file) => (contents.added(file), list.refresh())} />
      </div>
    {/if}
  {/if}
</Page>

{#if creating}
  <CreateFolderDialog parent={folder ?? null} oncreated={created} onclose={() => (creating = false)} />
{/if}

<style>
  .upload {
    margin-top: var(--space-xl);
  }
</style>
