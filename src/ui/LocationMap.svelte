<script lang="ts">
  import { settings } from '../settings';
  import { applyMapLook } from '../lib/maps/MapLook';

  /**
   * Small map around a map pin: OpenStreetMap data from OpenFreeMap, drawn by MapLibre in an
   * Apple-Maps-like look. MapLibre and the map data load only once the map scrolls into view and send
   * the viewer's address to openfreemap.org. The attribution ("i") is required by the licences and stays.
   */
  let { lat, lng, name }: { lat: number; lng: number; name: string } = $props();

  const map = settings.locations.map;

  function render(node: HTMLElement) {
    let stop: (() => void) | null = null;
    let gone = false;
    const observer = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      const [maplibre, { default: workerUrl }] = await Promise.all([
        import('maplibre-gl'),
        // Bundled by Vite: MapLibre would look for the worker next to its own file, which bundling moves.
        import('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'),
        import('maplibre-gl/dist/maplibre-gl.css'),
      ]);
      maplibre.setWorkerUrl(workerUrl);
      if (gone) return;
      const view = new maplibre.Map({
        container: node,
        style: map.style,
        center: [lng, lat],
        zoom: map.zoom,
        attributionControl: { compact: true },
        // The page scrolls with the wheel; zoom with the buttons, a double click or two fingers.
        scrollZoom: false,
        pitchWithRotate: false,
        dragRotate: false,
      });
      view.touchZoomRotate.disableRotation();
      view.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
      const dark = getComputedStyle(document.documentElement).colorScheme === 'dark';
      view.on('style.load', () => applyMapLook(view, dark));
      // The credits stay one click away behind the "i", like Apple's "Rechtliches".
      view.once('load', () => node.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show'));
      const pin = document.createElement('span');
      pin.className = 'map-pin';
      new maplibre.Marker({ element: pin, anchor: 'bottom' }).setLngLat([lng, lat]).addTo(view);
      stop = () => view.remove();
    });
    observer.observe(node);
    return () => {
      gone = true;
      observer.disconnect();
      stop?.();
    };
  }
</script>

{#key `${lat},${lng}`}
  <div class="map" role="region" aria-label="Karte: {name}" style:--map-height={map.height} {@attach render}></div>
{/key}

<style>
  .map {
    height: var(--map-height);
    overflow: hidden;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-hover);
  }
  /* Apple-style pin: a red disc with a white ring and a dot on a short white stem (tip on the place). */
  .map :global(.map-pin) {
    display: block;
    width: 30px;
    height: 38px;
    background:
      linear-gradient(#fff, #fff) bottom center / 3px 10px no-repeat,
      radial-gradient(circle at 15px 15px, #fff 0 4px, #ff3b30 4.5px 12px, #fff 12.5px 15px, transparent 15.5px) top / 30px 30px no-repeat;
    filter: drop-shadow(0 3px 5px rgb(0 0 0 / 0.3));
  }
  .map :global(.maplibregl-ctrl-group) {
    border-radius: 10px;
    box-shadow: 0 2px 8px rgb(0 0 0 / 0.15);
  }
  .map :global(.maplibregl-ctrl-attrib) {
    font-size: 10px;
  }
</style>
