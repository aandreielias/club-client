import type { AllPaintProperties, Map as MapLibreMap } from 'maplibre-gl';

/** Colours of the small map, close to Apple Maps (light and dark). */
const PALETTES = {
  light: {
    land: '#f6f4ef',
    residential: '#f1eee8',
    park: '#cfe8c0',
    water: '#a6d1f5',
    building: '#e7e4de',
    minor: '#ffffff',
    minorCasing: '#dedad2',
    major: '#ffe9a6',
    majorCasing: '#ecc96a',
    motorway: '#ffd476',
    motorwayCasing: '#e0ad48',
    rail: '#cfcac1',
    text: '#5c5a55',
    halo: '#ffffff',
  },
  dark: {
    land: '#2b2c2f',
    residential: '#2f3033',
    park: '#2f4433',
    water: '#1d3a57',
    building: '#3a3b3f',
    minor: '#46474c',
    minorCasing: '#2b2c2f',
    major: '#6b6045',
    majorCasing: '#2b2c2f',
    motorway: '#8a7140',
    motorwayCasing: '#2b2c2f',
    rail: '#4a4a4f',
    text: '#c9c8c4',
    halo: '#1f2023',
  },
};

/** Clutter Apple Maps leaves out at street level. */
const HIDDEN = ['natural_earth', 'building-3d', 'park_outline', 'road_one_way_arrow', 'road_one_way_arrow_opposite', 'poi_r20', 'poi_r7', 'highway-shield-non-us', 'highway-shield-us-interstate', 'road_shield_us', 'road_area_pattern'];

/**
 * Restyles OpenFreeMap's "liberty" style in place: soft land, white streets, yellow main roads, light
 * blue water, quiet labels. Layer ids that a later style version drops are skipped.
 */
export function applyMapLook(map: MapLibreMap, dark: boolean): void {
  const c = PALETTES[dark ? 'dark' : 'light'];
  const paint = (match: (id: string) => boolean, property: keyof AllPaintProperties, value: string) => {
    // Only layers of the property's type (`line-color` on line layers, `text-…` on symbols); a `waterway` label is a symbol.
    const prefix = (type: string) => (type === 'symbol' ? 'text-' : `${type}-`);
    for (const layer of map.getStyle().layers) if (property.startsWith(prefix(layer.type)) && match(layer.id)) map.setPaintProperty(layer.id, property, value);
  };
  const is = (...ids: string[]) => (id: string) => ids.includes(id);
  const ends = (suffix: string, ...parts: string[]) => (id: string) => id.endsWith(suffix) && parts.some((p) => id.includes(p));

  for (const id of HIDDEN) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
  paint(is('background'), 'background-color', c.land);
  paint(is('landuse_residential', 'landuse_school', 'landuse_hospital', 'landuse_cemetery'), 'fill-color', c.residential);
  paint(is('park', 'landcover_wood', 'landcover_grass', 'landuse_pitch', 'landuse_track'), 'fill-color', c.park);
  paint(is('water'), 'fill-color', c.water);
  paint((id) => id.startsWith('waterway'), 'line-color', c.water);
  paint(is('building'), 'fill-color', c.building);
  paint(is('building'), 'fill-outline-color', c.residential);
  // Streets: casings first, then the fills (both for tunnels, roads and bridges).
  paint(ends('_casing', 'minor', 'street', 'service', 'link', 'secondary', 'path'), 'line-color', c.minorCasing);
  paint(ends('_casing', 'trunk_primary'), 'line-color', c.majorCasing);
  paint(ends('_casing', 'motorway'), 'line-color', c.motorwayCasing);
  paint((id) => !id.endsWith('_casing') && /(minor|street|service_track|_link|secondary_tertiary|path_pedestrian)$/.test(id), 'line-color', c.minor);
  paint((id) => !id.endsWith('_casing') && id.endsWith('trunk_primary'), 'line-color', c.major);
  paint((id) => !id.endsWith('_casing') && id.endsWith('motorway'), 'line-color', c.motorway);
  paint((id) => /_rail(_hatching)?$/.test(id), 'line-color', c.rail);
  paint(() => true, 'text-color', c.text);
  paint(() => true, 'text-halo-color', c.halo);
}
