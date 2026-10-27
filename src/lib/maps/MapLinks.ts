/** A place as the map links need it; coordinates win over the address when both are known. */
export interface MapPlace {
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
}

/** Links to Google Maps and Apple Maps. */
export class MapLinks {
  /** What to search for: "Name, Address", or just the name. */
  static query(place: MapPlace): string {
    return place.address ? `${place.name}, ${place.address}` : place.name;
  }

  static google(place: MapPlace): string {
    const query = place.lat !== null && place.lng !== null ? `${place.lat},${place.lng}` : MapLinks.query(place);
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

  static apple(place: MapPlace): string {
    const at = place.lat !== null && place.lng !== null ? `&ll=${place.lat},${place.lng}` : '';
    return `https://maps.apple.com/?q=${encodeURIComponent(MapLinks.query(place))}${at}`;
  }
}
