<script lang="ts">
  import { settings } from '../../settings';
  import { CarLayout } from './CarLayout';
  import type { Ride } from './model';
  import { RidesModel } from './RidesModel.svelte';

  /**
   * The car seen from above: the driver, taken seats (solid) and free seats (accent outline).
   * Decorative detail for the "x von y frei" text next to it, which stays the source of truth.
   */
  let { ride }: { ride: Ride } = $props();

  const { SEAT_W, SEAT_H } = CarLayout;
  const shape = $derived(CarLayout.shape(ride.seats));
  const w = $derived(shape.width);
  const h = $derived(shape.height);
  const free = $derived(RidesModel.free(ride));
  const label = $derived(free ? `Auto von ${ride.driverName}: ${free} von ${ride.seats} Plätzen frei` : `Auto von ${ride.driverName}: voll`);
  /** Passengers take the offered seats in order (seat 1 is the front passenger seat). */
  const passenger = (seatIndex: number) => ride.passengers[seatIndex - 1] ?? null;
  const size = settings.calendar.rideGraphic;
</script>

<svg class="car" viewBox="0 0 {w} {h}" width={size.width} height={(size.width * h) / w}
  role="img" aria-label={label}>
  <!-- mirrors, body, windscreen and rear window -->
  <rect class="mirror" x="-3" y="20" width="6" height="5" rx="2.5" />
  <rect class="mirror" x={w - 3} y="20" width="6" height="5" rx="2.5" />
  <!-- body: a little narrower at the bonnet, rounder at the front than at the back -->
  <path class="body" d="M 13 0.5 H {w - 13} Q {w - 2} 0.5 {w - 1.5} 13 L {w - 0.5} {h - 12} Q {w - 0.5} {h - 0.5} {w - 11} {h - 0.5}
    H 11 Q 0.5 {h - 0.5} 0.5 {h - 12} L 1.5 13 Q 2 0.5 13 0.5 Z" />
  <rect class="roof" x="3.5" y="22" width={w - 7} height={h - 35} rx="5" />
  <path class="glass" d="M 7 14 Q {w / 2} 9 {w - 7} 14 L {w - 9} 22 Q {w / 2} 19 9 22 Z" />
  <path class="glass" d="M 9 {h - 13} Q {w / 2} {h - 15} {w - 9} {h - 13} L {w - 10} {h - 8} Q {w / 2} {h - 6} 10 {h - 8} Z" />

  {#each shape.seats as seat, i (i)}
    {@const taken = seat.offered ? passenger(i) : null}
    <rect class="seat" class:driver={seat.driver} class:taken={taken !== null} class:unoffered={!seat.driver && !seat.offered}
      x={seat.x} y={seat.y} width={SEAT_W} height={SEAT_H} rx="3.5">
      <title>{seat.driver ? `${ride.driverName} (fährt)` : seat.offered ? (taken?.name ?? 'Frei') : 'Nicht angeboten'}</title>
    </rect>
    {#if seat.driver}<circle class="wheel" cx={seat.x + SEAT_W / 2} cy={seat.y - 4} r="3.5" />{/if}
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
  .wheel {
    fill: none;
    stroke: var(--color-text-muted);
    stroke-width: 1.2;
  }
</style>
