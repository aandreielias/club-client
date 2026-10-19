<script lang="ts">
  import { usePane } from '../../lib/split/usePane';
  import { settings } from '../../settings';
  import { APP_ERROR, CONFIRM, TOAST, WINDOW_OPEN } from '../../channels';
  import { bus, commands, directory, pendingDeletes, permissions, preferences, session, store } from '../../lib/container';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import type { MenuEntry } from '../../lib/overlay/ContextMenuService.svelte';
  import { LinkClipboard } from '../../lib/window/LinkClipboard';
  import Button from '../../ui/Button.svelte';
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';
  import DataTable from '../../ui/DataTable.svelte';
  import Empty from '../../ui/Empty.svelte';
  import Icon from '../../ui/Icon.svelte';
  import Page from '../../ui/Page.svelte';
  import type { RowDrag } from '../../ui/rowDrag';
  import Breadcrumb from './Breadcrumb.svelte';
  import CreateFolderDialog from './CreateFolderDialog.svelte';
  import EditFileDialog from './EditFileDialog.svelte';
  import EditFolderDialog from './EditFolderDialog.svelte';
  import { FILES_CHANGED } from './events';
  import { FileMover } from './FileMover';
  import { FolderActions } from './FolderActions.svelte';
  import { FolderContents } from './FolderContents.svelte';
  import FolderGallery from './FolderGallery.svelte';
  import { FolderItemListModel, type FolderItem } from './FolderItemListModel.svelte';
  import { FolderTree } from './FolderTree.svelte';
  import { colorHue, type Folder, type StoredFile } from './model';
  import MoveFilesDialog from './MoveFilesDialog.svelte';
  import { fileDownloads, fileLinks, fileMover, filePolicy, filesApi, fileTypes, folderZip, photoTagDrops } from './services';
  import UploadPanel from './UploadPanel.svelte';

  /** '/files' (root folders) or '/files/:id' (one folder). */
  let { params }: { params: Record<string, string> } = $props();

  type View = 'table' | 'gallery';
  const pane = usePane();
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
  // Managers: every team's roster, so tagged people (photo filter, "Von") have names without asking for the PIN.
  if (permissions.isManager) directory.loadTeams().then(() => directory.loadRosters(directory.teams.map((t) => t.id))).catch(() => {});

  useBus(bus, FILES_CHANGED, ({ data }) => {
    // Folder changes (name, colour, cover, visibility) also show in the parent's listing.
    if (data.folderId !== folderId && data.change !== 'FOLDER_UPDATED') return;
    if (data.fileId) fileLinks.forget(data.fileId);
    void list.load();
  });

  const folder = $derived(folderId ? tree.get(folderId) : undefined);
  const canCreate = $derived(folderId ? !!folder && filePolicy.canCreateIn(folder, tree.depth(folder.id), tree.maxDepth) : filePolicy.canCreateRoot());
  // One view for all folders (Einstellungen remember it per browser).
  const shownView = $derived<View>(preferences.values.filesView);
  let creating = $state(false);
  useCommands(commands, { 'page.new': { run: () => (creating = true), when: () => canCreate } });

  /** Files can be dragged onto anything that links records (a message, Benötigt). */
  const record = (item: FolderItem) => (item.kind === 'file' ? { kind: 'file', id: `${item.file.folderId}:${item.file.id}`, title: item.name } : null);

  /** A member dropped onto a photo tile opens the photo with them in its tag editor. */
  const tagDrop = {
    accepts: (item: FolderItem) => item.kind === 'file' && !!folder && filePolicy.canTag(item.file, folder),
    drop: (item: FolderItem, memberId: string) => {
      if (item.kind !== 'file') return;
      photoTagDrops.set(item.file.id, memberId);
      open(item);
    },
  };

  function open(item: FolderItem) {
    if (item.kind === 'folder') pane.navigate(`/files/${item.id}`);
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

  /** Folder: open, edit. File: open, download, edit, delete (where allowed). */
  function itemMenu(item: FolderItem): MenuEntry[] {
    if (item.kind === 'folder') {
      const target = item.folder;
      return [
        { label: 'Öffnen', run: () => open(item) },
        ...(target.canManage ? [{ label: 'Bearbeiten', icon: 'edit' as const, run: () => (editingFolder = target) }] : []),
        { separator: true },
        { label: 'Als ZIP herunterladen', icon: 'download', run: () => void fileActions.zip(target) },
        { label: 'Link kopieren', icon: 'copy', run: () => void LinkClipboard.copy(bus, `/files/${target.id}`) },
      ];
    }
    const file = item.file;
    const modifiable = fileActions.canModify(file);
    return [
      { label: 'Öffnen', run: () => open(item) },
      { label: 'Herunterladen', icon: 'download', run: () => void download(item) },
      ...(modifiable ? [{ label: 'Bearbeiten', icon: 'edit' as const, run: () => (editingFile = file) }] : []),
      { separator: true },
      ...(modifiable ? [{ label: 'Löschen', icon: 'delete' as const, danger: true, run: () => fileActions.remove([file]) }] : []),
    ];
  }

  // Empty folder: create a subfolder (uploading has its own panel below).
  const emptyAction = $derived(canCreate ? { label: folderId ? 'Neuer Unterordner' : 'Neuer Ordner', icon: 'add' as const, run: () => (creating = true) } : null);

  const fileActions = new FolderActions({
    bus,
    api: filesApi,
    policy: filePolicy,
    mover: fileMover,
    zip: folderZip,
    deletes: pendingDeletes,
    tree,
    contents,
    folder: () => folder,
    reload: () => void list.load(),
  });
  let moving = $state(false);

  const drag: RowDrag<FolderItem> = {
    type: FileMover.DRAG_TYPE,
    can: (item) => item.kind === 'file' && !!folder?.canManage,
    payload: (item) => JSON.stringify(fileActions.dragged(item.id)),
    accepts: (item) => item.kind === 'folder' && item.folder.canManage,
    drop: (item, payload) => item.kind === 'folder' && void fileActions.moveTo(JSON.parse(payload), item.folder),
  };
  const crumbDrag: RowDrag<Folder> = {
    type: FileMover.DRAG_TYPE,
    can: () => false,
    payload: () => '',
    accepts: (target) => target.canManage && target.id !== folderId,
    drop: (target, payload) => void fileActions.moveTo(JSON.parse(payload), target),
  };

  let editingFolder = $state<Folder | null>(null);
  let editingFile = $state<StoredFile | null>(null);

  function folderSaved() {
    editingFolder = null;
    void list.load(); // visibility changes reach subfolders too
    bus.publish(TOAST, { text: 'Ordner gespeichert.' });
  }

  function fileSaved(saved: StoredFile) {
    const moved = saved.folderId !== editingFile?.folderId;
    editingFile = null;
    void list.load();
    bus.publish(TOAST, { text: moved ? 'Datei verschoben.' : 'Datei gespeichert.' });
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
      pane.navigate(target.parentId ? `/files/${target.parentId}` : '/files');
    } catch (error) {
      bus.publish(APP_ERROR, error);
    }
  }
</script>

<Page title={folder?.name ?? 'Dateien'}>
  {#snippet actions()}
    <ChoiceGroup name="files-view" label="Ansicht" options={VIEWS} bind:value={() => shownView, (v) => v && preferences.set('filesView', v)} />
    {#if folder}
      <Button icon="download" busy={fileActions.zipping} onclick={() => fileActions.zip(folder)} tooltip="Ordner mit Unterordnern als ZIP herunterladen" />
      <Button icon="copy" onclick={() => LinkClipboard.copy(bus, `/files/${folder.id}`)} tooltip="Link zu diesem Ordner kopieren" />
    {/if}
    {#if folder?.canManage}
      <Button icon="edit" onclick={() => (editingFolder = folder)} tooltip="Name, Sichtbarkeit, Farbe und Titelbild ändern">Bearbeiten</Button>
      <Button variant="danger" icon="delete" onclick={() => deleteFolder(folder)}>Ordner löschen</Button>
    {/if}
    {#if canCreate}<Button variant="primary" onclick={() => (creating = true)}>{folderId ? 'Neuer Unterordner' : 'Neuer Ordner'}</Button>{/if}
  {/snippet}
  {#snippet context()}
    <Breadcrumb path={folder ? tree.path(folder.id) : []} drag={crumbDrag} />
  {/snippet}

  {#if folderId && tree.folders.value && !folder}
    <Empty text="Ordner nicht gefunden." />
  {:else}
    {#if fileActions.selectedFiles.length && folder}
      <div class="selection" role="toolbar" aria-label="Auswahl">
        <span class="count">{fileActions.selectedFiles.length} ausgewählt</span>
        {#if folder.canManage}<Button size="sm" icon="move" onclick={() => (moving = true)}>Verschieben</Button>{/if}
        <Button size="sm" icon="download" busy={fileActions.zipping} onclick={() => fileActions.zip(folder, fileActions.selectedFiles)} tooltip="Auswahl als ZIP herunterladen">Als ZIP</Button>
        {#if fileActions.selectedFiles.every((f) => fileActions.canModify(f))}
          <Button size="sm" variant="danger" icon="delete" onclick={() => fileActions.remove(fileActions.selectedFiles)} tooltip="Ausgewählte Dateien löschen">Löschen</Button>
        {/if}
        <Button size="sm" variant="ghost" onclick={() => fileActions.selected.clear()}>Auswahl aufheben</Button>
      </div>
    {/if}
    {#if shownView === 'gallery'}
      <FolderGallery model={list} onopen={open} menu={itemMenu} emptyText={folderId ? 'Noch nichts hochgeladen.' : 'Noch keine Ordner.'} {emptyAction} {drag} {record} {tagDrop}
        selected={(item) => fileActions.selected.has(item.id)} onselect={(item) => fileActions.toggle(item.id)} />
    {:else}
      <DataTable model={list} rowKey={(item) => item.id} onopen={open}
        {record} menu={itemMenu} emptyText={folderId ? 'Noch nichts hochgeladen.' : 'Noch keine Ordner.'} {emptyAction} {drag}
        check={contents ? { checked: (item) => fileActions.selected.has(item.id), toggle: (item) => fileActions.toggle(item.id), hidden: (item) => item.kind === 'folder', label: (item) => `${item.name} auswählen` } : undefined}>
        {#snippet cell(item, column)}
          {#if column.key === 'actions'}
            {#if item.kind === 'file' && fileActions.canModify(item.file)}
              {@const file = item.file}
              <Button size="sm" variant="ghost" icon="edit" onclick={(e) => (e.stopPropagation(), (editingFile = file))} tooltip="Umbenennen oder verschieben" />
              <Button size="sm" variant="ghost" icon="delete" onclick={(e) => (e.stopPropagation(), fileActions.remove([file]))} tooltip="Datei löschen" />
            {:else if item.kind === 'folder' && item.folder.canManage}
              {@const target = item.folder}
              <Button size="sm" variant="ghost" icon="edit" onclick={(e) => (e.stopPropagation(), (editingFolder = target))} tooltip="Ordner bearbeiten" />
            {/if}
          {:else if column.key === 'name'}
            <span class="name-cell">
              {#if item.kind === 'folder'}
                <span class="folder-icon" style:color={colorHue(item.folder.color) ? `var(--color-tag-${colorHue(item.folder.color)}-text)` : null}><Icon name="files" small /></span>
              {/if}
              <span>{item.name}</span>
            </span>
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

{#if moving && folder}
  <MoveFilesDialog files={fileActions.selectedFiles} {folder} {tree} onclose={() => (moving = false)} onmoved={() => ((moving = false), fileActions.moved())} />
{/if}
{#if editingFolder}
  <EditFolderDialog folder={editingFolder} onsaved={folderSaved} onclose={() => (editingFolder = null)} />
{/if}
{#if editingFile && folder}
  <EditFileDialog file={editingFile} {folder} {tree} onsaved={fileSaved} onclose={() => (editingFile = null)} />
{/if}

{#if creating}
  <CreateFolderDialog parent={folder ?? null} oncreated={created} onclose={() => (creating = false)} />
{/if}

<style>
  .selection {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-sm);
    margin-bottom: var(--space-sm);
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--radius-lg);
    background: var(--color-accent-soft);
    animation: rise var(--motion-base) var(--motion-easing);
  }
  .count {
    margin-right: auto;
    font-weight: var(--font-weight-medium);
  }
  .name-cell {
    display: inline-flex;
    align-items: center;
    gap: var(--space-sm);
  }
  .folder-icon {
    display: inline-flex;
    color: var(--color-text-faint);
  }
  .upload {
    margin-top: var(--space-xl);
  }
</style>
