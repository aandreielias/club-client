import { api } from '../../lib/container';
import { LocationsApi } from './LocationsApi';

/** Location services, created once and shared by the location views and the appointment editor. */
export const locationsApi = new LocationsApi(api);
