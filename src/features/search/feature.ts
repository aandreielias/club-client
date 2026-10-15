import type { Feature } from '../Feature';
import { SEARCH_MESSAGES } from './messages';
import SearchPage from './SearchPage.svelte';

/** Global search; the field lives in the sidebar (ui/GlobalSearch), results on /search. */
export const searchFeature: Feature = {
  id: 'search',
  routes: [{ path: '/search', component: SearchPage }],
  messages: SEARCH_MESSAGES,
};
