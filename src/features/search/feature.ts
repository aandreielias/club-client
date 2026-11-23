import { lazy } from '../../ui/lazy';
import type { Feature } from '../Feature';
import { SEARCH_MESSAGES } from './messages';

const SearchPage = lazy(() => import('./SearchPage.svelte'));

/** Global search; the field lives in the sidebar (ui/GlobalSearch), results on /search. */
export const searchFeature: Feature = {
  id: 'search',
  routes: [{ path: '/search', component: SearchPage }],
  messages: SEARCH_MESSAGES,
};
