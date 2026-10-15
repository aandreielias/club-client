import type { Feature } from '../Feature';
import FilesPage from './FilesPage.svelte';
import { FILE_MESSAGES } from './messages';
import PhotoView from './PhotoView.svelte';

export const filesFeature: Feature = {
  id: 'files',
  routes: [
    { path: '/files', component: FilesPage, nav: 'Dateien' },
    { path: '/files/:id', component: FilesPage },
  ],
  windows: { photo: { component: PhotoView } },
  messages: FILE_MESSAGES,
};
