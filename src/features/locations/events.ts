// Live event types of the locations module (server: LocationsApi.LocationChanged).

import { liveEvent } from '../../lib/live/LiveUpdates.svelte';

export const LOCATION_CHANGED = liveEvent<LocationChanged>('locations.location-changed');

export interface LocationChanged {
  locationId: string;
  change: 'CREATED' | 'UPDATED' | 'DELETED';
  name: string;
}
