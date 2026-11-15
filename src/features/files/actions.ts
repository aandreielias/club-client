import { attempt, inWindow, type RecordAction, type RecordActionProvider } from '../../lib/actions/RecordActions';
import { bus, pendingDeletes } from '../../lib/container';
import type { Folder, StoredFile } from './model';
import { fileDownloads, filePolicy, filesApi } from './services';

/** A file with its folder (rights come from the folder); the window id is `<folderId>:<fileId>`. */
export interface FileRecord {
  folder: Folder;
  file: StoredFile;
}

/** What can be done with a file: context menus, its window and the command palette. */
export const fileActions: RecordActionProvider<FileRecord> = {
  load: async (id) => {
    const [folderId, fileId] = id.split(':');
    const [folders, files] = await Promise.all([filesApi.folders(), filesApi.files(folderId)]);
    const folder = folders.find((f) => f.id === folderId);
    const file = files.find((f) => f.id === fileId);
    if (!folder || !file) throw new Error(`file ${id} not found`);
    return { folder, file };
  },
  actions: ({ folder, file }) => {
    const id = `${folder.id}:${file.id}`;
    const download: RecordAction = {
      command: 'record.download',
      icon: 'download',
      group: 'open',
      run: () => attempt(bus, () => fileDownloads.download(file)),
    };
    if (!filePolicy.canModify(file, folder)) return [download];
    return [
      download,
      inWindow(bus, 'file', id, 'record.edit', { icon: 'edit', group: 'edit' }),
      inWindow(bus, 'file', id, 'file.newVersion', { icon: 'upload', group: 'edit' }),
      ...(filePolicy.canTag(file, folder) ? [inWindow(bus, 'file', id, 'file.tag', { group: 'edit' })] : []),
      {
        command: 'record.delete',
        icon: 'delete',
        danger: true,
        group: 'remove',
        leaves: true,
        run: () => pendingDeletes.schedule({ ids: [file.id], text: `„${file.name}“ gelöscht.`, commit: () => filesApi.deleteFile(file.id) }),
      },
    ];
  },
};
