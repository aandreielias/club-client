<script lang="ts">
  import { settings } from '../../settings';
  import { CarLayout } from './CarLayout';
  import type { Ride } from './model';
  import { RidesModel } from './RidesModel.svelte';

  /**
   * The car seen from above, driving to the left: driver and taken seats solid, free seats in the accent
   * outline, seats not offered faint. Detail for the "x von y frei" text next to it, which stays the source of truth.
   */
  let { ride }: { ride: Ride } = $props();

  const { SEAT } = CarLayout;
  const shape = $derived(CarLayout.shape(ride.seats));
  const w = $derived(shape.width);
  const h = $derived(shape.height);
  const free = $derived(RidesModel.free(ride));
  const label = $derived(free ? `Auto von ${ride.driverName}: ${free} von ${ride.seats} Plätzen frei` : `Auto von ${ride.driverName}: voll`);
  /** Passengers take the offered seats in filling order (seat 1 is the front passenger seat). */
  const passenger = (seatIndex: number) => ride.passengers[seatIndex - 1] ?? null;
  const size = settings.calendar.rideGraphic;
</script>

<svg class="car" viewBox="0 0 {w} {h}" width={size.width} height={(size.width * h) / w} role="img" aria-label={label}>
  <rect class="mirror" x="20" y="-3" width="5" height="6" rx="2.5" />
  <rect class="mirror" x="20" y={h - 3} width="5" height="6" rx="2.5" />
  <!-- body: narrower at the bonnet (left), rounder in front than at the back -->
  <path
    class="body"
    d="M 0.5 13 V {h - 13} Q 0.5 {h - 1.5} 13 {h - 0.5} H {w - 11} Q {w - 0.5} {h - 0.5} {w - 0.5} {h - 11}
    V 11 Q {w - 0.5} 0.5 {w - 11} 0.5 H 13 Q 0.5 1.5 0.5 13 Z"
  />
  <rect class="roof" x="22" y="3.5" width={w - 35} height={h - 7} rx="5" />
  <path class="glass" d="M 14 7 Q 9 {h / 2} 14 {h - 7} L 22 {h - 9} Q 19 {h / 2} 22 9 Z" />
  <path class="glass" d="M {w - 13} 9 Q {w - 15} {h / 2} {w - 13} {h - 9} L {w - 8} {h - 10} Q {w - 6} {h / 2} {w - 8} 10 Z" />

  {#each shape.seats as seat, i (i)}
    {@const taken = seat.offered && !seat.driver ? passenger(i) : null}
    <rect
      class="seat"
      class:driver={seat.driver}
      class:taken={taken !== null}
      class:unoffered={!seat.offered}
      x={seat.x}
      y={seat.y}
      width={SEAT}
      height={SEAT}
      rx="3.5"
    >
      <title>{seat.driver ? `${ride.driverName} (fährt)` : seat.offered ? (taken?.name ?? 'Frei') : 'Nicht angeboten'}</title>
    </rect>
  {/each}
</svg>

<style>
  .car {
    display: block;
    flex: none;
    overflow: visible;
  }
  .body {
    fill: var(--color-surface);
    stroke: var(--color-border-strong);
  }
  .mirror {
    fill: var(--color-border-strong);
  }
  .glass {
    fill: var(--color-hover);
  }
  .roof {
    fill: none;
    stroke: var(--color-border);
  }
  .seat {
    fill: var(--color-accent-soft);
    stroke: var(--color-accent);
    stroke-width: 1;
    transition:
      fill var(--motion-base) var(--motion-easing),
      stroke var(--motion-base) var(--motion-easing);
  }
  .seat.taken,
  .seat.driver {
    fill: var(--color-text-faint);
    stroke: transparent;
  }
  .seat.unoffered {
    fill: transparent;
    stroke: var(--color-border);
  }
</style>
