import type { TeamDirectory } from '../../lib/directory/TeamDirectory.svelte';
import { ListModel } from '../../lib/list/ListModel.svelte';
import type { LocalStore } from '../../lib/storage/LocalStore';
import type { Formatter } from '../../lib/time/Formatter';
import type { FileTypes } from './FileTypes';
import type { FolderContents } from './FolderContents.svelte';
import type { FolderTree } from './FolderTree.svelte';
import { FOLDER_KINDS, type Folder, type StoredFile } from './model';

export type FolderItem = { kind: 'folder'; id: string; name: string; folder: Folder } | { kind: 'file'; id: string; name: string; file: StoredFile };

/** Contents of one folder (or the root): its subfolders and files as one list with table and gallery views. */
export class FolderItemListModel extends ListModel<FolderItem> {
  constructor(
    private readonly tree: FolderTree,
    private readonly contents: FolderContents | null,
    private readonly folderId: string | null,
    types: FileTypes,
    format: () => Formatter,
    directory: TeamDirectory,
    store: LocalStore,
  ) {
    super(
      {
        id: 'files',
        load: async () => {
          await Promise.all([tree.load(), contents?.load()]);
          return this.items();
        },
        defaultSort: { key: 'name', dir: 'asc' },
        searchText: (item) => item.name,
        columns: [
          { key: 'name', label: 'Name', value: (item) => `${item.kind === 'folder' ? 0 : 1}${item.name}` },
          {
            key: 'type',
            label: 'Typ',
            value: (item) => (item.kind === 'folder' ? (FOLDER_KINDS.find((k) => k.value === item.folder.kind)?.label ?? 'Ordner') : types.label(item.file.contentType)),
            width: '9rem',
          },
          {
            key: 'size',
            label: 'Größe',
            value: (item) => (item.kind === 'file' ? item.file.sizeBytes : null),
            format: (item) => (item.kind === 'file' ? format().bytes(item.file.sizeBytes) : ''),
            width: '7rem',
            align: 'end',
            hideOnCompact: true,
          },
          {
            key: 'createdAt',
            label: 'Hochgeladen',
            value: (item) => (item.kind === 'file' ? item.file.createdAt : null),
            format: (item) => (item.kind === 'file' ? format().dateTime(item.file.createdAt) : ''),
            width: '11rem',
            hideOnCompact: true,
          },
          {
            key: 'by',
            label: 'Von',
            value: (item) => (item.kind === 'file' ? directory.nameOf(item.file.uploadedBy) : null),
            width: '10rem',
            hideOnCompact: true,
          },
          { key: 'actions', label: 'Aktionen', value: () => null, sortable: false, width: '6rem', align: 'end' },
        ],
        filters: [
          {
            key: 'type',
            label: 'Typ',
            kind: 'select',
            allLabel: 'Alle Typen',
            options: () => [
              { value: 'folder', label: 'Ordner' },
              { value: 'image', label: 'Bilder' },
              { value: 'document', label: 'Dokumente' },
            ],
            test: (item, value) =>
              value === 'folder' ? item.kind === 'folder' : item.kind === 'file' && types.isImage(item.file.contentType) === (value === 'image'),
          },
        ],
      },
      store,
    );
  }

  /** Rebuilds the rows from the already loaded tree and contents (after uploads and deletes). */
  refresh(): void {
    this.set(this.items());
  }

  private items(): FolderItem[] {
    const folders: FolderItem[] = this.tree.children(this.folderId).map((folder) => ({ kind: 'folder', id: folder.id, name: folder.name, folder }));
    const files: FolderItem[] = (this.contents?.files.value ?? []).map((file) => ({ kind: 'file', id: file.id, name: file.name, file }));
    return [...folders, ...files];
  }
}
