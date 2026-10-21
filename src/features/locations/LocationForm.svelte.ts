import { FormState } from '../../lib/state/FormState.svelte';
import { settings } from '../../settings';
import type { Location, LocationPatch, NewLocation } from './model';

export type LocationField = 'name' | 'street' | 'zip' | 'city' | 'note' | 'coordinates';
export type LocationFormErrors = Partial<Record<LocationField, string>>;

const limits = settings.locations;

/** Editable state of a new or existing place; validation mirrors the server's Location. */
export class LocationForm extends FormState<LocationFormErrors> {
  name = $state('');
  street = $state('');
  zip = $state('');
  city = $state('');
  note = $state('');
  /** Text inputs, so a half-typed number is not lost; empty = no map pin. */
  lat = $state('');
  lng = $state('');

  private constructor(readonly original: Location | null) {
    super();
  }

  static blank(): LocationForm {
    return new LocationForm(null);
  }

  static edit(location: Location): LocationForm {
    const form = new LocationForm(location);
    form.name = location.name;
    form.street = location.street ?? '';
    form.zip = location.zip ?? '';
    form.city = location.city ?? '';
    form.note = location.note ?? '';
    form.lat = location.lat?.toString() ?? '';
    form.lng = location.lng?.toString() ?? '';
    return form;
  }

  /** "Hauptplatz 1, 1010 Wien" for the map search; empty without an address. */
  get address(): string {
    const town = [this.zip.trim(), this.city.trim()].filter(Boolean).join(' ');
    return [this.street.trim(), town].filter(Boolean).join(', ');
  }

  get pinned(): boolean {
    return this.lat.trim() !== '' && this.lng.trim() !== '';
  }

  setPin(lat: number, lng: number): void {
    this.lat = lat.toFixed(6);
    this.lng = lng.toFixed(6);
  }

  clearPin(): void {
    this.lat = '';
    this.lng = '';
  }

  toNew(): NewLocation {
    return {
      name: this.name.trim(),
      street: this.street.trim() || null,
      zip: this.zip.trim() || null,
      city: this.city.trim() || null,
      note: this.note.trim() || null,
      lat: this.pinned ? Number(this.lat) : null,
      lng: this.pinned ? Number(this.lng) : null,
    };
  }

  /** Every field is sent; empty texts clear them, a removed pin is cleared explicitly. */
  toPatch(): LocationPatch {
    const value = this.toNew();
    const patch: LocationPatch = { ...value, street: value.street ?? '', zip: value.zip ?? '', city: value.city ?? '', note: value.note ?? '' };
    if (!this.pinned) {
      delete patch.lat;
      delete patch.lng;
      patch.clearCoordinates = true;
    }
    return patch;
  }

  protected validate(): LocationFormErrors {
    const errors: LocationFormErrors = {};
    const name = this.name.trim();
    if (!name || name.length > limits.nameMaxLength) errors.name = `Name mit 1 bis ${limits.nameMaxLength} Zeichen angeben.`;
    if (this.street.trim().length > limits.streetMaxLength) errors.street = `Höchstens ${limits.streetMaxLength} Zeichen.`;
    if (this.zip.trim().length > limits.zipMaxLength) errors.zip = `Höchstens ${limits.zipMaxLength} Zeichen.`;
    if (this.city.trim().length > limits.cityMaxLength) errors.city = `Höchstens ${limits.cityMaxLength} Zeichen.`;
    if (this.note.trim().length > limits.noteMaxLength) errors.note = `Höchstens ${limits.noteMaxLength} Zeichen.`;
    const lat = Number(this.lat);
    const lng = Number(this.lng);
    const half = (this.lat.trim() === '') !== (this.lng.trim() === '');
    if (half || (this.pinned && (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180))) {
      errors.coordinates = 'Breite (−90 bis 90) und Länge (−180 bis 180) zusammen angeben.';
    }
    return errors;
  }
}
