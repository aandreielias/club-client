import { api } from '../../lib/container';
import { SearchApi } from './SearchApi';

export const searchApi = new SearchApi(api);
