import type { Feature } from '../Feature';
import AccountPage from './AccountPage.svelte';

export const accountFeature: Feature = {
  id: 'account',
  routes: [{ path: '/account', component: AccountPage, nav: 'Mein Konto' }],
  links: [{ server: '/me/security', to: () => ({ path: '/account' }) }],
};
