import FilesHome from './FilesHome.svelte';
import type { Feature } from '../Feature';
import ComparePage from './ComparePage.svelte';
import FilesPage from './FilesPage.svelte';
import { FILE_MESSAGES } from './messages';
import PhotoView from './PhotoView.svelte';

export const filesFeature: Feature = {
  id: 'files',
  routes: [
    { path: '/files', component: FilesPage, nav: 'Dateien', icon: 'files' },
    { path: '/files/:id', component: FilesPage },
    { path: '/files/:id/compare', component: ComparePage },
  ],
  // `photo` stays for links that name it; both show any file.
  windows: { file: { component: PhotoView }, photo: { component: PhotoView } },
  messages: FILE_MESSAGES,
  home: { id: 'files', label: 'Ordner', component: FilesHome },
};
