<script lang="ts">
  import { settings } from '../settings';
  import { MapLinks } from '../lib/maps/MapLinks';

  /**
   * Small OpenStreetMap around a map pin, loaded only when scrolled into view. Loading it sends the viewer's
   * address to openstreetmap.org (see the privacy notice).
   */
  let { lat, lng, name }: { lat: number; lng: number; name: string } = $props();

  const map = settings.locations.map;
</script>

<iframe class="map" title="Karte: {name}" src={MapLinks.embed(lat, lng, map.span)} loading="lazy" referrerpolicy="no-referrer"
  style:--map-height={map.height}></iframe>

<style>
  .map {
    display: block;
    width: 100%;
    height: var(--map-height);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-hover);
  }
</style>
