import { lazy } from '../../ui/lazy';
import type { Feature } from '../Feature';

const AccountPage = lazy(() => import('./AccountPage.svelte'));

export const accountFeature: Feature = {
  id: 'account',
  routes: [{ path: '/account', component: AccountPage }],
  links: [{ server: '/account', to: () => ({ path: '/account' }) }],
};
