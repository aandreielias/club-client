import { lazy } from '../../ui/lazy';
import type { Feature } from '../Feature';

const SettingsPage = lazy(() => import('./SettingsPage.svelte'));
const SettingsView = lazy(() => import('./SettingsView.svelte'));

export const settingsFeature: Feature = {
  id: 'settings',
  routes: [
    // Guests too: their own view and notification settings (club tabs stay behind roles).
    { path: '/settings', component: SettingsPage, nav: 'Einstellungen', icon: 'settings', navFooter: true, guest: true },
    { path: '/settings/:section', component: SettingsPage, guest: true },
  ],
  windows: {
    settings: { label: 'Einstellungen', component: SettingsView, page: (section) => `/settings/${encodeURIComponent(section)}` },
  },
};
