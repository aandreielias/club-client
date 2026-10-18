import { ListModel } from '../../lib/list/ListModel.svelte';
import type { LocalStore } from '../../lib/storage/LocalStore';
import type { LocationsApi } from './LocationsApi';
import type { Location } from './model';

/** The list of places: search by name and address, sorted by name or city. */
export class LocationListModel extends ListModel<Location> {
  constructor(api: LocationsApi, store: LocalStore | null) {
    super(
      {
        id: 'locations',
        load: () => api.list(),
        defaultSort: { key: 'name', dir: 'asc' },
        searchText: (l) => `${l.name} ${l.address ?? ''} ${l.note ?? ''}`,
        columns: [
          { key: 'name', label: 'Name', value: (l) => l.name },
          { key: 'address', label: 'Adresse', value: (l) => l.address, hideOnCompact: true },
          { key: 'city', label: 'Ort', value: (l) => l.city, width: '10rem' },
        ],
        filters: [],
      },
      store,
    );
  }
}
