// Live event of the files module (server: FilesApi.FilesChanged).

export const FILES_CHANGED = 'files.files-changed';

export interface FilesChanged {
  folderId: string;
  fileId: string;
  change: 'UPLOADED' | 'DELETED' | 'TAGGED';
}
