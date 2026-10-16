// Live event of the files module (server: FilesApi.FilesChanged).

import { liveEvent } from '../../lib/live/LiveUpdates.svelte';

export const FILES_CHANGED = liveEvent<FilesChanged>('files.files-changed');

export interface FilesChanged {
  folderId: string;
  /** null for FOLDER_UPDATED. */
  fileId: string | null;
  change: 'UPLOADED' | 'DELETED' | 'TAGGED' | 'UPDATED' | 'FOLDER_UPDATED';
}
