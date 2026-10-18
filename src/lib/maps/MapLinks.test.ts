import { describe, expect, it } from 'vitest';
import { MapLinks } from './MapLinks';

const hall = { name: 'Halle Nord', address: 'Hauptplatz 1, 1010 Wien', lat: null, lng: null };

describe('MapLinks', () => {
  it('searches by name and address, or by coordinates once known', () => {
    expect(MapLinks.google(hall)).toBe('https://www.google.com/maps/search/?api=1&query=Halle%20Nord%2C%20Hauptplatz%201%2C%201010%20Wien');
    expect(MapLinks.apple(hall)).toBe('https://maps.apple.com/?q=Halle%20Nord%2C%20Hauptplatz%201%2C%201010%20Wien');
    const pinned = { ...hall, lat: 48.2, lng: 16.37 };
    expect(MapLinks.google(pinned)).toBe('https://www.google.com/maps/search/?api=1&query=48.2%2C16.37');
    expect(MapLinks.apple(pinned)).toContain('&ll=48.2,16.37');
    expect(MapLinks.google({ ...hall, address: null })).toContain('query=Halle%20Nord');
  });

  it('frames the pin in the embed', () => {
    expect(MapLinks.embed(48.2, 16.37, 0.01)).toBe(
      'https://www.openstreetmap.org/export/embed.html?bbox=16.35400,48.19000,16.38600,48.21000&layer=mapnik&marker=48.2,16.37',
    );
  });
});
