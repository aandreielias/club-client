import type { Feature } from '../Feature';
import SettingsPage from './SettingsPage.svelte';
import SettingsView from './SettingsView.svelte';

export const settingsFeature: Feature = {
  id: 'settings',
  routes: [
    // Guests too: their own view and notification settings (club tabs stay behind roles).
    { path: '/settings', component: SettingsPage, nav: 'Einstellungen', icon: 'settings', navFooter: true, guest: true },
    { path: '/settings/:section', component: SettingsPage, guest: true },
  ],
  windows: { settings: { component: SettingsView, page: (section) => `/settings/${encodeURIComponent(section)}` } },
};
