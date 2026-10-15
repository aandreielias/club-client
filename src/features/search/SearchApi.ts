import type { ApiClient } from '../../lib/http/ApiClient';
import type { SearchHit, SearchResult } from './model';

/** The global search of club-server: everything the member may see whose text contains the query. */
export class SearchApi {
  static readonly PATH = '/api/v1/search';

  constructor(private readonly api: ApiClient) {}

  async search(query: string, perKind: number): Promise<SearchHit[]> {
    return (await this.api.get<SearchResult>(SearchApi.PATH, { q: query.trim(), limit: perKind })).hits;
  }
}
