import type { Feature } from '../Feature';
import SettingsPage from './SettingsPage.svelte';
import SettingsView from './SettingsView.svelte';

export const settingsFeature: Feature = {
  id: 'settings',
  routes: [
    { path: '/settings', component: SettingsPage, nav: 'Einstellungen', navFooter: true },
    { path: '/settings/:section', component: SettingsPage },
  ],
  windows: { settings: { component: SettingsView, page: (section) => `/settings/${encodeURIComponent(section)}` } },
};
