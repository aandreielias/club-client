/** A place as the map links need it; coordinates win over the address when both are known. */
export interface MapPlace {
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
}

/** Links to Google Maps and Apple Maps and the OpenStreetMap embed for the small map. */
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

  /** OpenStreetMap embed around the pin; `span` is the half width in degrees. */
  static embed(lat: number, lng: number, span: number): string {
    const bbox = [lng - span * 1.6, lat - span, lng + span * 1.6, lat + span].map((n) => n.toFixed(5)).join(',');
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
  }
}
