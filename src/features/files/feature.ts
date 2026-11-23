import { lazy } from '../../ui/lazy';
import { fileActions } from './actions';
import type { Feature } from '../Feature';
import { FILE_MESSAGES } from './messages';

const FilesHome = lazy(() => import('./FilesHome.svelte'));
const ComparePage = lazy(() => import('./ComparePage.svelte'));
const FilesPage = lazy(() => import('./FilesPage.svelte'));
const PhotoView = lazy(() => import('./PhotoView.svelte'));

export const filesFeature: Feature = {
  id: 'files',
  routes: [
    { path: '/files', component: FilesPage, nav: 'Dateien', icon: 'files' },
    { path: '/files/:id', component: FilesPage },
    { path: '/files/:id/compare', component: ComparePage },
  ],
  // `photo` stays for links that name it; both show any file.
  actions: { file: fileActions, photo: fileActions },
  windows: { file: { label: 'Datei', component: PhotoView }, photo: { label: 'Foto', component: PhotoView } },
  messages: FILE_MESSAGES,
  home: { id: 'files', label: 'Ordner', component: FilesHome },
};
