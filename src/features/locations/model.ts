// Mirrors of the club-server locations DTOs (LocationsApi).

export interface Location {
  id: string;
  name: string;
  street: string | null;
  zip: string | null;
  city: string | null;
  /** Street, zip and city as one line; null without any. */
  address: string | null;
  note: string | null;
  lat: number | null;
  lng: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewLocation {
  name: string;
  street: string | null;
  zip: string | null;
  city: string | null;
  note: string | null;
  lat: number | null;
  lng: number | null;
}

/** Null keeps a value, an empty text clears it; clearCoordinates removes the map pin. */
export type LocationPatch = Partial<Omit<NewLocation, 'lat' | 'lng'>> & { lat?: number | null; lng?: number | null; clearCoordinates?: boolean };

export interface GeocodeResult {
  found: boolean;
  lat: number | null;
  lng: number | null;
  label: string | null;
}
