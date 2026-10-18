import { api, session } from '../../lib/container';
import { LocationPolicy } from './LocationPolicy';
import { LocationsApi } from './LocationsApi';

/** Location services, created once and shared by the location views and the appointment editor. */
export const locationsApi = new LocationsApi(api);
export const locationPolicy = new LocationPolicy(session);
