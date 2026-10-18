import { describe, expect, it } from 'vitest';
import { LocationForm } from './LocationForm.svelte';

describe('LocationForm', () => {
  it('validates like the server and builds the address line', () => {
    const form = LocationForm.blank();
    expect(Object.keys(form.errors)).toEqual(['name']);
    form.name = ' Halle Nord ';
    form.street = 'Hauptplatz 1';
    form.city = 'Wien';
    form.zip = '1010';
    expect(form.address).toBe('Hauptplatz 1, 1010 Wien');
    form.lat = '48.2';
    expect(form.errors.coordinates).toBeDefined();
    form.setPin(48.2, 16.3738);
    expect(form.toNew()).toEqual({ name: 'Halle Nord', street: 'Hauptplatz 1', zip: '1010', city: 'Wien', note: null, lat: 48.2, lng: 16.3738 });
  });

  it('clears a removed pin and empty texts on edit', () => {
    const form = LocationForm.edit({
      id: 'l', name: 'Halle', street: 'Weg 1', zip: null, city: null, address: 'Weg 1', note: 'Hinten', lat: 1, lng: 2, createdAt: '', updatedAt: '',
    });
    form.note = '';
    form.clearPin();
    expect(form.toPatch()).toEqual({ name: 'Halle', street: 'Weg 1', zip: '', city: '', note: '', clearCoordinates: true });
  });
});
