import type { ApiClient } from '../../lib/http/ApiClient';
import type { GeocodeResult, Location, LocationPatch, NewLocation } from './model';

/** Typed access to the locations endpoints of club-server. */
export class LocationsApi {
  static readonly BASE = '/api/v1/locations';

  constructor(private readonly api: ApiClient) {}

  /** Every place, by name. */
  async list(): Promise<Location[]> {
    return (await this.api.get<{ items: Location[] }>(LocationsApi.BASE)).items;
  }

  get(id: string): Promise<Location> {
    return this.api.get<Location>(this.path(id));
  }

  create(location: NewLocation): Promise<Location> {
    return this.api.post<Location>(LocationsApi.BASE, location);
  }

  update(id: string, patch: LocationPatch): Promise<Location> {
    return this.api.patch<Location>(this.path(id), patch);
  }

  /** Appointments keep the name as text. */
  delete(id: string): Promise<void> {
    return this.api.delete(this.path(id));
  }

  /** Address to map pin (OpenStreetMap). */
  geocode(address: string): Promise<GeocodeResult> {
    return this.api.post<GeocodeResult>(`${LocationsApi.BASE}/geocode`, { address });
  }

  private path(id: string): string {
    return `${LocationsApi.BASE}/${encodeURIComponent(id)}`;
  }
}
