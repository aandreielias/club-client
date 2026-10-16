// Live event of the files module (server: FilesApi.FilesChanged).

import { liveEvent } from '../../lib/live/LiveUpdates.svelte';

export const FILES_CHANGED = liveEvent<FilesChanged>('files.files-changed');

export interface FilesChanged {
  folderId: string;
  fileId: string;
  change: 'UPLOADED' | 'DELETED' | 'TAGGED';
}
