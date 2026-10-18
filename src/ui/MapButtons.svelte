<script lang="ts">
  import { MapLinks, type MapPlace } from '../lib/maps/MapLinks';

  /** "Google Maps" and "Apple Maps" for a place: route planning in the member's own app. */
  let { place }: { place: MapPlace } = $props();
</script>

<span class="maps">
  <a class="map-link" href={MapLinks.google(place)} target="_blank" rel="noopener noreferrer">Google Maps</a>
  <a class="map-link" href={MapLinks.apple(place)} target="_blank" rel="noopener noreferrer">Apple Maps</a>
</span>

<style>
  .maps {
    display: inline-flex;
    flex-wrap: wrap;
    gap: var(--space-xs) var(--space-md);
  }
  .map-link {
    color: var(--color-text-muted);
    font-size: var(--font-size-small);
    text-decoration: underline;
    text-decoration-color: var(--color-border-strong);
    text-underline-offset: 2px;
  }
  .map-link:hover {
    color: var(--color-text);
  }
</style>
