// Mock of the club-server locations module (LocationHandlers): everyone reads, admin/board/coaches manage.
import { settings } from '../../settings';
import { directory, type MockDirectory } from '../../lib/mock/core';
import { MockServer, mockServer, type MockRequest } from '../../lib/mock/MockServer';
import { MockTable } from '../../lib/mock/MockTable';
import { PRIVILEGED, type Member } from '../../lib/types';
import type { GeocodeResult, Location, LocationPatch, NewLocation } from './model';

const fail = MockServer.fail;
const limits = settings.locations;

type StoredLocation = Omit<Location, 'address'>;

export class MockLocations {
  readonly locations = new MockTable<StoredLocation[]>('locations', () => MockLocations.seed());

  constructor(private readonly people: MockDirectory) {}

  list(): Location[] {
    return [...this.locations.data].sort((a, b) => a.name.localeCompare(b.name, 'de')).map(MockLocations.dto);
  }

  get(id: string): Location {
    return MockLocations.dto(this.find(id));
  }

  /** server: LocationsApi.REFS */
  ref(id: string): Location | null {
    const stored = this.locations.data.find((l) => l.id === id);
    return stored ? MockLocations.dto(stored) : null;
  }

  create(member: Member, body: Partial<NewLocation>): Location {
    this.people.requirePrivileged(member, PRIVILEGED);
    const now = new Date().toISOString();
    const location = this.validated({
      id: crypto.randomUUID(),
      name: '',
      street: null,
      zip: null,
      city: null,
      note: null,
      lat: null,
      lng: null,
      ...body,
      createdAt: now,
      updatedAt: now,
    });
    this.locations.data.push(location);
    this.locations.save();
    this.changed(location, 'CREATED');
    return MockLocations.dto(location);
  }

  update(member: Member, id: string, patch: LocationPatch): Location {
    this.people.requirePrivileged(member, PRIVILEGED);
    const current = this.find(id);
    const defined = Object.fromEntries(Object.entries(patch).filter(([k, v]) => v !== null && v !== undefined && k !== 'clearCoordinates'));
    const next = this.validated({ ...current, ...defined, updatedAt: new Date().toISOString() });
    if (patch.clearCoordinates) Object.assign(next, { lat: null, lng: null });
    Object.assign(current, next);
    this.locations.save();
    this.changed(current, 'UPDATED');
    return MockLocations.dto(current);
  }

  delete(member: Member, id: string): void {
    this.people.requirePrivileged(member, PRIVILEGED);
    const location = this.find(id);
    this.locations.data.splice(this.locations.data.indexOf(location), 1);
    this.locations.save();
    this.changed(location, 'DELETED');
  }

  /** Stand-in for Nominatim: a stable point near Vienna for any address with a street number. */
  geocode(member: Member, address: unknown): GeocodeResult {
    this.people.requireRole(member, PRIVILEGED);
    if (typeof address !== 'string' || !address.trim()) return fail(400, 'location.address-missing');
    if (!/\d/.test(address)) return { found: false, lat: null, lng: null, label: null };
    const hash = [...address].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 10_000, 7);
    return { found: true, lat: 48.17 + (hash % 100) / 1_000, lng: 16.3 + Math.floor(hash / 100) / 1_000, label: `${address.trim()}, Österreich` };
  }

  /** server: Location constructor checks */
  private validated(l: StoredLocation): StoredLocation {
    const text = (value: string | null, max: number, code: string) => {
      const trimmed = value?.trim() || null;
      if ((trimmed?.length ?? 0) > max) fail(400, code);
      return trimmed;
    };
    const name = l.name?.trim() ?? '';
    if (!name || name.length > limits.nameMaxLength) fail(400, 'location.name-invalid');
    if (this.locations.data.some((o) => o.id !== l.id && o.name.toLowerCase() === name.toLowerCase())) fail(409, 'location.name-taken');
    if ((l.lat === null) !== (l.lng === null) || (l.lat !== null && (Math.abs(l.lat) > 90 || Math.abs(l.lng!) > 180)))
      fail(400, 'location.coordinates-invalid');
    return {
      ...l,
      name,
      street: text(l.street, limits.streetMaxLength, 'location.street-invalid'),
      zip: text(l.zip, limits.zipMaxLength, 'location.zip-invalid'),
      city: text(l.city, limits.cityMaxLength, 'location.city-invalid'),
      note: text(l.note, limits.noteMaxLength, 'location.note-too-long'),
    };
  }

  private changed(location: StoredLocation, change: 'CREATED' | 'UPDATED' | 'DELETED'): void {
    mockServer.events.publish({
      type: 'locations.location-changed',
      data: { locationId: location.id, change, name: location.name },
      audience: { everyone: true },
    });
  }

  private find(id: string): StoredLocation {
    return this.locations.data.find((l) => l.id === id) ?? fail(404, 'location.not-found');
  }

  static dto(l: StoredLocation): Location {
    const town = [l.zip, l.city].filter(Boolean).join(' ');
    const address = [l.street, town].filter(Boolean).join(', ') || null;
    return { ...l, address };
  }

  private static seed(): StoredLocation[] {
    const at = new Date().toISOString();
    const place = (
      id: string,
      name: string,
      street: string | null,
      zip: string | null,
      city: string | null,
      lat: number | null,
      lng: number | null,
      note: string | null = null,
    ): StoredLocation => ({ id, name, street, zip, city, note, lat, lng, createdAt: at, updatedAt: at });
    return [
      place(
        'l-nord',
        'Turnhalle Nord',
        'Brigittenauer Lände 50',
        '1200',
        'Wien',
        48.2318,
        16.3713,
        'Eingang über den Hof, Schlüssel beim Schulwart.',
      ),
      place('l-sued', 'Turnhalle Süd', 'Gudrunstraße 120', '1100', 'Wien', 48.1803, 16.3812),
      place('l-west', 'Sportzentrum West', 'Hütteldorfer Straße 2', '1150', 'Wien', 48.1975, 16.3264, 'Parkplatz hinter der Halle.'),
      place('l-heim', 'Vereinsheim', 'Praterstraße 12', '1020', 'Wien', 48.2147, 16.3842),
    ];
  }
}

export const locations = new MockLocations(directory);

const actor = (req: MockRequest) => directory.actor(req);

mockServer
  .on('GET', '/api/v1/locations', (req) => (actor(req), { items: locations.list() }))
  .on('POST', '/api/v1/locations', (req) => locations.create(actor(req), req.body ?? {}))
  .on('POST', '/api/v1/locations/geocode', (req) => locations.geocode(actor(req), req.body?.address))
  .on('GET', '/api/v1/locations/:id', (req) => (actor(req), locations.get(req.params.id)))
  .on('PATCH', '/api/v1/locations/:id', (req) => locations.update(actor(req), req.params.id, req.body ?? {}))
  .on('DELETE', '/api/v1/locations/:id', (req) => locations.delete(actor(req), req.params.id));
